import { z } from 'zod'
import { DotNetDateTime, HealthStatus } from './common.js'

/** Tag: `ApiDeviceStatus` */

/** A single reporting participant in the system (node, master, ingester or client). */
export const NodeStatus = z.object({
	/** Hostname for clients (`eye-default.stagetec.com.au`), display name otherwise (`Node 1`). */
	id: z.string(),
	statusTimeUTC: DotNetDateTime,
	statusTimeSecondsAgo: z.int(),
	status: HealthStatus,
	/** CPU load percentage. `-1` is the sentinel used for a participant that is `Down`. */
	cpuLoad: z.number(),
})
export type NodeStatus = z.infer<typeof NodeStatus>

/**
 * `GET /api/status`
 *
 * Liveness of the master serving the request. Note this is a narrower shape than
 * {@link NodeStatus} — no timing or CPU fields.
 */
export const GetStatusResponse = z.object({
	id: z.string(),
	status: HealthStatus,
})
export type GetStatusResponse = z.infer<typeof GetStatusResponse>

/** `GET /api/status/all` — every participant, bucketed by role. */
export const GetStatusAllResponse = z.object({
	nodes: z.array(NodeStatus),
	masters: z.array(NodeStatus),
	ingesters: z.array(NodeStatus),
	clients: z.array(NodeStatus),
})
export type GetStatusAllResponse = z.infer<typeof GetStatusAllResponse>

/** `GET /api/status/client/{clientHostName}` — path parameters. */
export const GetClientStatusParams = z.object({
	clientHostName: z.string(),
})
export type GetClientStatusParams = z.infer<typeof GetClientStatusParams>

/**
 * `GET /api/status/client/{clientHostName}`
 *
 * Returns `404` with a `ProblemDetails` body for an unknown host name.
 */
export const GetClientStatusResponse = NodeStatus
export type GetClientStatusResponse = z.infer<typeof GetClientStatusResponse>
