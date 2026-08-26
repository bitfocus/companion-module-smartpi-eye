import { z } from 'zod'
import { UnknownResponse } from './common.js'

/** Tag: `ApiMessages` */

/** A stored message template, as listed by `GET /api/messages`. */
export const MessageSummary = z.object({
	id: z.int(),
	name: z.string(),
})
export type MessageSummary = z.infer<typeof MessageSummary>

/** A display group that a message can be pushed to. */
export const Group = z.object({
	id: z.int(),
	name: z.string(),
})
export type Group = z.infer<typeof Group>

/** `GET /api/messages` */
export const GetMessagesResponse = z.array(MessageSummary)
export type GetMessagesResponse = z.infer<typeof GetMessagesResponse>

/** `GET /api/groups` */
export const GetGroupsResponse = z.array(Group)
export type GetGroupsResponse = z.infer<typeof GetGroupsResponse>

/** `PUT /api/group/{groupId}/showmessage/{messageId}` — path parameters. */
export const ShowMessageParams = z.object({
	groupId: z.int(),
	messageId: z.int(),
})
export type ShowMessageParams = z.infer<typeof ShowMessageParams>

/**
 * `PUT /api/group/{groupId}/showmessage/{messageId}`
 *
 * Takes no request body. The OpenAPI document describes the response only as `200 OK`;
 * this endpoint mutates live displays so it was not exercised to discover the body.
 */
export const ShowMessageResponse = UnknownResponse
export type ShowMessageResponse = z.infer<typeof ShowMessageResponse>

/** `PUT /api/group/{groupId}/hidemessage` — path parameters. */
export const HideMessageParams = z.object({
	groupId: z.int(),
})
export type HideMessageParams = z.infer<typeof HideMessageParams>

/**
 * `PUT /api/group/{groupId}/hidemessage`
 *
 * Takes no request body. Response body undocumented — see {@link ShowMessageResponse}.
 */
export const HideMessageResponse = UnknownResponse
export type HideMessageResponse = z.infer<typeof HideMessageResponse>
