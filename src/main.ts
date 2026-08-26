import {
	InstanceBase,
	InstanceStatus,
	type DropdownChoice,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema, FeedbackIDs } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import PQueue from 'p-queue'
import { Agent, request } from 'undici'
import type { z } from 'zod'
import {
	buildPath,
	endpoints,
	GetGroupsResponse,
	GetIngesterJobsResponse,
	GetMessagesResponse,
	GetModesResponse,
	GetStatusResponse,
	type EndpointName,
} from './schemas/index.js'
import { isDeepStrictEqual } from 'node:util'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

type EndpointMap = typeof endpoints

/**
 * `params` is required for endpoints whose path has placeholders and rejected for those that
 * don't; `body` likewise. Both shapes come from the schemas, so a typo in a path parameter is
 * a compile error rather than a 404.
 */
type MessageFor<K extends EndpointName> = { endpoint: K } & (EndpointMap[K]['params'] extends z.ZodType
	? { params: z.input<EndpointMap[K]['params']> }
	: { params?: never }) &
	(EndpointMap[K]['body'] extends z.ZodType ? { body: z.input<EndpointMap[K]['body']> } : { body?: never })

/** The polled lists that can be looked up by id. */
export type NameProperty = 'mode' | 'group' | 'message'

/** A request against any one of the endpoints in the registry. */
export type Message = { [K in EndpointName]: MessageFor<K> }[EndpointName]

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()
	#secrets: ModuleSecrets | undefined
	#controller: AbortController = new AbortController()
	#queue = new PQueue({ concurrency: 1, autoStart: true, interval: 10, intervalCap: 1, strict: true })
	#dispatcher: Agent | undefined
	#pollTimer: NodeJS.Timeout | undefined
	#polling = false
	#mode: GetModesResponse | undefined
	#groups: GetGroupsResponse | undefined
	#messages: GetMessagesResponse | undefined
	#status: GetStatusResponse | undefined
	#jobs: GetIngesterJobsResponse | undefined
	#jobsSummary: Record<string, number> | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.#secrets = secrets
		this.#updateDispatcher()

		this.updateStatus(InstanceStatus.Ok)

		void this.configUpdated(config, secrets)
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		this.#stopPolling()
		this.#controller.abort('Module destroyed')
		this.#queue.clear()
		await this.#dispatcher?.close()
		this.#dispatcher = undefined
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.#secrets = secrets
		this.#controller.abort('Config Updated')

		this.#controller = new AbortController()

		process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.allowInsecure ? '0' : '1'

		this.#updateDispatcher()
		this.#updateCompanionBits()
		this.#startPolling()
	}

	/**
	 * Rebuilds the undici dispatcher for the current config. Only needed to opt out of TLS
	 * verification — otherwise `undefined` leaves undici on its global dispatcher.
	 */
	#updateDispatcher(): void {
		const previous = this.#dispatcher
		this.#dispatcher =
			this.config.protocol === 'https' && this.config.allowInsecure
				? new Agent({ connect: { rejectUnauthorized: false } })
				: undefined
		void previous?.close()
	}

	/**
	 * (Re)starts the poll loop on the configured interval, which is in *seconds*.
	 * Always stops an existing loop first, so calling this repeatedly is safe.
	 */
	#startPolling(): void {
		this.#stopPolling()

		this.#pollTimer = setInterval(() => void this.#poll(), this.config.interval * 1000)
		void this.#poll() // don't make the user wait a whole interval for the first result
	}

	/** Cancels the poll loop if one is running. Safe to call when it isn't. */
	#stopPolling(): void {
		if (this.#pollTimer === undefined) return

		clearInterval(this.#pollTimer)
		this.#pollTimer = undefined
	}

	/**
	 * Fetches one endpoint and validates it. Returns `undefined` if the body did not match the
	 * schema, so a single malformed list does not discard the rest of the poll.
	 */
	async #fetch<T>(message: Message, schema: z.ZodType<T>): Promise<T | undefined> {
		const result = schema.safeParse(await this.sendMsg(message))
		if (result.success) return result.data

		this.log('error', `Unexpected response from ${endpoints[message.endpoint].path}: ${result.error.message}`)
		return undefined
	}

	/**
	 * One poll cycle: refresh the lists the Companion definitions are built from, and rebuild
	 * those definitions once if any of them changed.
	 */
	async #poll(): Promise<void> {
		// A slow response must not let cycles stack up behind each other
		if (this.#polling) return
		this.#polling = true

		const signal = this.#controller.signal

		try {
			const [modes, groups, messages, status, jobs] = await Promise.all([
				this.#fetch({ endpoint: 'getModes' }, GetModesResponse),
				this.#fetch({ endpoint: 'getGroups' }, GetGroupsResponse),
				this.#fetch({ endpoint: 'getMessages' }, GetMessagesResponse),
				this.#fetch({ endpoint: 'getStatus' }, GetStatusResponse),
				this.#fetch({ endpoint: 'getIngesterJobs' }, GetIngesterJobsResponse),
			])

			// A cached list is `undefined` until the first successful poll, so it never deep-equals
			// a fetched one — the first poll always counts as a change.
			let changed = false
			if (modes !== undefined && !isDeepStrictEqual(this.#mode, modes)) {
				this.#mode = modes
				changed = true
			}
			if (groups !== undefined && !isDeepStrictEqual(this.#groups, groups)) {
				this.#groups = groups
				changed = true
			}
			if (messages !== undefined && !isDeepStrictEqual(this.#messages, messages)) {
				this.#messages = messages
				changed = true
			}

			// Once per poll, however many of the lists moved
			if (changed) this.#updateCompanionBits()

			// These feed variables rather than definitions, so they are published separately —
			// batched into one write, in the same spirit as the single rebuild above
			const values: Partial<VariablesSchema> = {}
			if (status !== undefined && !isDeepStrictEqual(this.#status, status)) {
				this.#status = status
				values.id = status.id
				values.status = status.status
			}
			if (jobs !== undefined) {
				if (!isDeepStrictEqual(this.#jobs, jobs)) {
					this.#jobs = jobs
					values.ingester_jobs = jobs
				}

				// Compared separately: `lastRunTime` moves on almost every poll, so the raw list
				// churns while the per-status counts usually do not
				const summary = summariseJobs(jobs)
				if (!isDeepStrictEqual(this.#jobsSummary, summary)) {
					this.#jobsSummary = summary
					values.ingester_jobs_summary = summary
				}
			}
			if (Object.keys(values).length > 0) this.setVariableValues(values)

			const malformed =
				modes === undefined ||
				groups === undefined ||
				messages === undefined ||
				status === undefined ||
				jobs === undefined
			if (malformed) {
				this.updateStatus(InstanceStatus.UnknownWarning, 'Unexpected response, see log')
			} else {
				this.updateStatus(InstanceStatus.Ok)
			}
		} catch (err) {
			// An abort means the config changed or the module went away, not a failure
			if (signal.aborted) return

			this.log('error', `Poll failed: ${err instanceof Error ? err.message : String(err)}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		} finally {
			this.#polling = false
		}
	}

	#updateCompanionBits(): void {
		this.#updateActions()
		this.#updateFeedbacks()
		this.#updatePresets()
		this.#updateVariableDefinitions()
		this.checkFeedbacks(FeedbackIDs.GetName) // force a refresh of the value feedback
	}

	/**
	 * Issues a single API request and returns its decoded body.
	 *
	 * Deliberately does no schema validation — the caller owns that, so it can pick the
	 * matching schema from `./schemas` and decide how to handle a mismatch:
	 *
	 * ```ts
	 * const modes = GetModesResponse.parse(await this.sendMsg({ endpoint: 'getModes' }))
	 * ```
	 *
	 * Resolves to the parsed JSON for a JSON body, the raw text for anything else, and
	 * `undefined` for an empty body (which the mutating endpoints return).
	 */
	public async sendMsg(msg: Message, signal?: AbortSignal): Promise<unknown> {
		const combinedSignal = signal ? AbortSignal.any([signal, this.#controller.signal]) : this.#controller.signal

		const response = await this.#queue.add(
			async ({ signal: taskSignal }) => {
				const endpoint = endpoints[msg.endpoint]
				const path = buildPath(endpoint.path, msg.params ?? {})
				const url = `${this.config.protocol}://${this.config.host}${path}`

				const headers: Record<string, string> = {
					Accept: 'application/json, text/plain, */*',
				}

				if (this.config.apikey) {
					const apiKey = this.#secrets?.xapikey
					if (!apiKey) throw new Error(`X-API-Key is enabled but no key is configured`)
					headers['X-Api-Key'] = apiKey
				}

				const sendBody = endpoint.body !== null && msg.body !== undefined
				if (sendBody) headers['Content-Type'] = 'application/json'

				this.log('debug', `Sending: ${endpoint.method} ${url}`)
				const {
					statusCode,
					headers: responseHeaders,
					body,
				} = await request(url, {
					method: endpoint.method,
					signal: taskSignal,
					dispatcher: this.#dispatcher,
					headers,
					body: sendBody ? JSON.stringify(msg.body) : undefined,
				})

				const contentType = String(responseHeaders['content-type'] ?? '')
				const text = await body.text()

				if (statusCode < 200 || statusCode >= 300) {
					throw new Error(
						`Unexpected status ${statusCode} for ${endpoint.method} ${path}${describeErrorBody(text, contentType)}`,
					)
				}

				// The mutating endpoints answer 200 with no body
				if (text.length === 0) return undefined

				if (!contentType.includes('json')) {
					this.log('debug', `Unexpected non-JSON response from ${path}: ${text}`)
					return text
				}

				try {
					return JSON.parse(text)
				} catch (err) {
					throw new Error(`Failed to parse JSON from ${path}: ${(err as Error).message}. Body: ${text}`, {
						cause: err,
					})
				}
			},
			{ signal: combinedSignal },
		)

		return response
	}

	/**
	 * The modes from the most recent successful poll, as dropdown choices.
	 * Empty until the first poll lands.
	 */
	public getModeChoices(): DropdownChoice<number>[] {
		return (this.#mode ?? []).map((mode) => ({
			id: mode.id,
			label: mode.name || `Mode ${mode.id}`,
		}))
	}

	/**
	 * The groups from the most recent successful poll, as dropdown choices.
	 * Empty until the first poll lands.
	 */
	public getGroupChoices(): DropdownChoice<number>[] {
		return (this.#groups ?? []).map((group) => ({
			id: group.id,
			label: group.name || `Group ${group.id}`,
		}))
	}

	/**
	 * The messages from the most recent successful poll, as dropdown choices.
	 * Empty until the first poll lands.
	 */
	public getMessageChoices(): DropdownChoice<number>[] {
		return (this.#messages ?? []).map((message) => ({
			id: message.id,
			label: message.name || `Message ${message.id}`,
		}))
	}

	/**
	 * The name of one entry in a polled list, or `undefined` if that id is not in the list
	 * we last saw — which also covers the window before the first poll lands.
	 */
	public getName(property: NameProperty, id: number): string | undefined {
		const entries: { id: number; name: string }[] | undefined =
			property === 'mode' ? this.#mode : property === 'group' ? this.#groups : this.#messages

		return entries?.find((entry) => entry.id === id)?.name
	}

	// Return config fields for web config
	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	#updateActions(): void {
		UpdateActions(this)
	}

	#updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	#updatePresets(): void {
		UpdatePresets(this)
	}

	#updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

/** Counts ingester jobs by their scheduler state, e.g. `{ Started: 20, Stopped: 2 }`. */
function summariseJobs(jobs: GetIngesterJobsResponse): Record<string, number> {
	const summary: Record<string, number> = {}

	for (const job of jobs) {
		summary[job.jobStatus] = (summary[job.jobStatus] ?? 0) + 1
	}

	return summary
}

/**
 * Renders a failed response for an error message. The API returns RFC 9457 problem documents,
 * so prefer `title`/`detail` over dumping the whole body (which carries only a trace id).
 */
function describeErrorBody(text: string, contentType: string): string {
	if (text.length === 0) return ''

	if (contentType.includes('json')) {
		try {
			const parsed: unknown = JSON.parse(text)
			if (parsed !== null && typeof parsed === 'object') {
				const { title, detail } = parsed as { title?: unknown; detail?: unknown }
				const parts = [title, detail].filter((part): part is string => typeof part === 'string' && part.length > 0)
				if (parts.length > 0) return ` - ${parts.join(': ')}`
			}
		} catch {
			// not valid JSON after all, fall through to the raw body
		}
	}

	return ` - ${text.slice(0, 200)}`
}
