import type { z } from 'zod'

import * as DeviceStatusApi from './device-status.js'
import * as IngesterJobsApi from './ingester-jobs.js'
import * as MessagesApi from './messages.js'
import * as ModeApi from './mode.js'
import * as MonitoringApi from './monitoring.js'
import * as RealtimeTextMessageApi from './realtime-text-message.js'

export * from './common.js'
export * from './device-status.js'
export * from './ingester-jobs.js'
export * from './messages.js'
export * from './mode.js'
export * from './monitoring.js'
export * from './realtime-text-message.js'

export type HttpMethod = 'GET' | 'POST' | 'PUT'

export type EndpointDefinition = {
	method: HttpMethod
	/** Path template, with `{param}` placeholders matching the `params` schema keys. */
	path: string
	/** Path parameters, or `null` when the endpoint takes none. */
	params: z.ZodType | null
	/** Request body, or `null` when the endpoint takes none. */
	body: z.ZodType | null
	response: z.ZodType
}

/**
 * Every operation in the PID.Master OpenAPI document, keyed by operation name.
 *
 * All endpoints are covered by the `headerApiKey` security scheme — send the key in an
 * `X-Api-Key` header. (The `GET` endpoints answered without one during testing, but do
 * not rely on that.)
 */
export const endpoints = {
	getStatus: {
		method: 'GET',
		path: '/api/status',
		params: null,
		body: null,
		response: DeviceStatusApi.GetStatusResponse,
	},
	getStatusAll: {
		method: 'GET',
		path: '/api/status/all',
		params: null,
		body: null,
		response: DeviceStatusApi.GetStatusAllResponse,
	},
	getClientStatus: {
		method: 'GET',
		path: '/api/status/client/{clientHostName}',
		params: DeviceStatusApi.GetClientStatusParams,
		body: null,
		response: DeviceStatusApi.GetClientStatusResponse,
	},
	getIngesterJobs: {
		method: 'GET',
		path: '/api/ingester/jobs',
		params: null,
		body: null,
		response: IngesterJobsApi.GetIngesterJobsResponse,
	},
	getMessages: {
		method: 'GET',
		path: '/api/messages',
		params: null,
		body: null,
		response: MessagesApi.GetMessagesResponse,
	},
	getGroups: {
		method: 'GET',
		path: '/api/groups',
		params: null,
		body: null,
		response: MessagesApi.GetGroupsResponse,
	},
	showMessage: {
		method: 'PUT',
		path: '/api/group/{groupId}/showmessage/{messageId}',
		params: MessagesApi.ShowMessageParams,
		body: null,
		response: MessagesApi.ShowMessageResponse,
	},
	hideMessage: {
		method: 'PUT',
		path: '/api/group/{groupId}/hidemessage',
		params: MessagesApi.HideMessageParams,
		body: null,
		response: MessagesApi.HideMessageResponse,
	},
	getModes: {
		method: 'GET',
		path: '/api/mode',
		params: null,
		body: null,
		response: ModeApi.GetModesResponse,
	},
	setMode: {
		method: 'PUT',
		path: '/api/mode/{id}',
		params: ModeApi.SetModeParams,
		body: null,
		response: ModeApi.SetModeResponse,
	},
	getDevices: {
		method: 'GET',
		path: '/api/monitoring/devices',
		params: null,
		body: null,
		response: MonitoringApi.GetDevicesResponse,
	},
	getDevice: {
		method: 'GET',
		path: '/api/monitoring/devices/{uid}',
		params: MonitoringApi.GetDeviceParams,
		body: null,
		response: MonitoringApi.GetDeviceResponse,
	},
	getRealtimeTextMessages: {
		method: 'GET',
		path: '/api/realtimetextmessage',
		params: null,
		body: null,
		response: RealtimeTextMessageApi.GetRealtimeTextMessagesResponse,
	},
	getRealtimeTextMessage: {
		method: 'GET',
		path: '/api/realtimetextmessage/{id}',
		params: RealtimeTextMessageApi.GetRealtimeTextMessageParams,
		body: null,
		response: RealtimeTextMessageApi.GetRealtimeTextMessageResponse,
	},
	postRealtimeTextMessage: {
		method: 'POST',
		path: '/api/realtimetextmessage',
		params: null,
		body: RealtimeTextMessageApi.PostRealtimeTextMessageRequest,
		response: RealtimeTextMessageApi.PostRealtimeTextMessageResponse,
	},
} as const satisfies Record<string, EndpointDefinition>

export type EndpointName = keyof typeof endpoints

/** Substitutes `{param}` placeholders in an endpoint path template, URI-encoding each value. */
export function buildPath(template: string, params: Record<string, string | number> = {}): string {
	return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
		const value = params[key]
		if (value === undefined) throw new Error(`Missing path parameter '${key}' for '${template}'`)
		return encodeURIComponent(value)
	})
}
