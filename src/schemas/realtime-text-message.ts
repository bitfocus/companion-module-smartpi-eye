import { z } from 'zod'
import { DotNetDateTime, UnknownResponse } from './common.js'

/** Tag: `ApiRealtimeTextMessage` */

/**
 * A realtime text message, as returned by the `GET` endpoints.
 *
 * This is the one shape the OpenAPI document actually defines (`components.schemas.TextMessage`);
 * `groupName` and `message` are declared nullable there, the rest are not.
 */
export const TextMessage = z.object({
	id: z.int(),
	/**
	 * Declared `int64` upstream. Values seen so far are small, but a genuine 64-bit value
	 * would exceed `Number.MAX_SAFE_INTEGER` — `z.int()` rejects those rather than
	 * silently accepting a rounded number.
	 */
	seqNumber: z.int(),
	groupName: z.string().nullable(),
	message: z.string().nullable(),
	priority: z.int(),
	timeToDisplay: DotNetDateTime,
	expiryTime: DotNetDateTime,
})
export type TextMessage = z.infer<typeof TextMessage>

/**
 * Request body for `POST /api/realtimetextmessage`.
 *
 * The upstream schema marks no property as required and sets `additionalProperties: false`,
 * so every field is optional here and unknown keys are rejected rather than stripped.
 */
export const TextMessageInput = z.strictObject({
	id: z.int().optional(),
	seqNumber: z.int().optional(),
	groupName: z.string().nullable().optional(),
	message: z.string().nullable().optional(),
	priority: z.int().optional(),
	timeToDisplay: DotNetDateTime.optional(),
	expiryTime: DotNetDateTime.optional(),
})
export type TextMessageInput = z.infer<typeof TextMessageInput>

/** `GET /api/realtimetextmessage` */
export const GetRealtimeTextMessagesResponse = z.array(TextMessage)
export type GetRealtimeTextMessagesResponse = z.infer<typeof GetRealtimeTextMessagesResponse>

/** `GET /api/realtimetextmessage/{id}` — path parameters. */
export const GetRealtimeTextMessageParams = z.object({
	id: z.int(),
})
export type GetRealtimeTextMessageParams = z.infer<typeof GetRealtimeTextMessageParams>

/**
 * `GET /api/realtimetextmessage/{id}`
 *
 * Returns `404` with a `ProblemDetails` body for an unknown id.
 */
export const GetRealtimeTextMessageResponse = TextMessage
export type GetRealtimeTextMessageResponse = z.infer<typeof GetRealtimeTextMessageResponse>

/** `POST /api/realtimetextmessage` — request body. */
export const PostRealtimeTextMessageRequest = TextMessageInput
export type PostRealtimeTextMessageRequest = z.infer<typeof PostRealtimeTextMessageRequest>

/**
 * `POST /api/realtimetextmessage`
 *
 * The OpenAPI document describes the response only as `200 OK`; this endpoint pushes text
 * to live displays so it was not exercised to discover the body.
 */
export const PostRealtimeTextMessageResponse = UnknownResponse
export type PostRealtimeTextMessageResponse = z.infer<typeof PostRealtimeTextMessageResponse>
