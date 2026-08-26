import { z } from 'zod'

/**
 * Shared primitives for the PID.Master API (https://surface.smart-pi.info/swagger).
 *
 * The published OpenAPI document declares every response as a bare `200 OK` with no
 * content schema, so the response shapes below were derived from live responses and
 * are documented per field where the wire format is surprising.
 */

/**
 * A .NET `DateTime` serialised without a timezone offset, e.g. `2026-08-26T04:38:15.436`.
 * Despite the `UTC` suffix on some field names, no offset is present on the wire, so
 * `local: true` is required for these to validate.
 */
export const DotNetDateTime = z.iso.datetime({ local: true })
export type DotNetDateTime = z.infer<typeof DotNetDateTime>

/** Unix epoch seconds, e.g. `1782719011`. Used by the monitoring endpoints. */
export const UnixSeconds = z.int()
export type UnixSeconds = z.infer<typeof UnixSeconds>

/**
 * Alarm flags are transported as the *strings* `'true'` / `'false'`, not JSON booleans.
 * Kept as a string so validation never rejects an unexpected value; use {@link parseAlarmFlag}
 * to interpret one.
 */
export const AlarmFlag = z.string().nullable()
export type AlarmFlag = z.infer<typeof AlarmFlag>

/** Interprets an {@link AlarmFlag}. Anything other than `'true'` (case-insensitive) is false. */
export function parseAlarmFlag(flag: AlarmFlag): boolean {
	return flag?.trim().toLowerCase() === 'true'
}

/**
 * Health of a node/master/ingester/client. `'Ok'` and `'Down'` are the values observed;
 * left open so an unknown state does not fail validation.
 */
export const HealthStatus = z.string()
export type HealthStatus = z.infer<typeof HealthStatus>

/**
 * RFC 9457 problem document returned by ASP.NET Core for 4xx/5xx, e.g. requesting an
 * unknown device uid returns `404` with this body and `content-type: application/problem+json`.
 */
export const ProblemDetails = z
	.object({
		type: z.string().optional(),
		title: z.string().optional(),
		status: z.int().optional(),
		detail: z.string().optional(),
		instance: z.string().optional(),
		traceId: z.string().optional(),
		errors: z.record(z.string(), z.array(z.string())).optional(),
	})
	.loose()
export type ProblemDetails = z.infer<typeof ProblemDetails>

/**
 * Response body of an endpoint the OpenAPI document describes only as `200 OK` and which
 * has not been exercised against a live server (the mutating `PUT`s).
 */
export const UnknownResponse = z.unknown()
export type UnknownResponse = z.infer<typeof UnknownResponse>
