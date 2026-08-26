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
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import PQueue from 'p-queue'
import { Agent, request } from 'undici'
import type { z } from 'zod'
import { buildPath, endpoints, GetModesResponse, type EndpointName } from './schemas/index.js'
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
	 * One poll cycle: fetch the mode list and, if it differs from what we last saw, cache it
	 * and rebuild the action/feedback/preset/variable definitions that are derived from it.
	 */
	async #poll(): Promise<void> {
		// A slow response must not let cycles stack up behind each other
		if (this.#polling) return
		this.#polling = true

		const signal = this.#controller.signal

		try {
			const modes = GetModesResponse.safeParse(await this.sendMsg({ endpoint: 'getModes' }))

			if (!modes.success) {
				this.log('error', `Unexpected response from ${endpoints.getModes.path}: ${modes.error.message}`)
				this.updateStatus(InstanceStatus.UnknownWarning, 'Unexpected mode list')
				return
			}

			// First poll always counts as a change, since there is nothing to compare against
			if (this.#mode === undefined || !isDeepStrictEqual(this.#mode, modes.data)) {
				this.#mode = modes.data
				this.#updateCompanionBits()
			}

			this.updateStatus(InstanceStatus.Ok)
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
	getModeChoices(): DropdownChoice<number>[] {
		return (this.#mode ?? []).map((mode) => ({
			id: mode.id,
			label: mode.name || `Mode ${mode.id}`,
		}))
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
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
