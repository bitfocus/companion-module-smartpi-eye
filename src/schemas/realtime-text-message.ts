import { z } from 'zod'
import { DotNetDateTime, UnknownResponse } from './common.js'

/** Tag: `ApiRealtimeTextMessage` */

/**
 * Declared `int64` upstream, so a value can exceed `Number.MAX_SAFE_INTEGER`.
 *
 * `JSON.parse` has already rounded such a value by the time this runs and the exact digits
 * are not recoverable here, but a sequence number is only compared and displayed — losing
 * the last few digits beats dropping the whole message, which `z.int()` would do. Still
 * rejects non-integers and non-numbers.
 */
const SeqNumber = z.number().refine(Number.isInteger, { error: 'Expected an integer' })

/**
 * A realtime text message, as returned by the `GET` endpoints.
 *
 * This is the one shape the OpenAPI document actually defines (`components.schemas.TextMessage`);
 * `groupName` and `message` are declared nullable there, the rest are not.
 */
export const TextMessage = z.object({
	id: z.int(),
	seqNumber: SeqNumber,
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
	seqNumber: SeqNumber.optional(),
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
