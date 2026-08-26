import { z } from 'zod'
import { UnknownResponse } from './common.js'

/** Tag: `ApiMode` */

/** A selectable display mode, e.g. `EYE-MDL - Clock`. */
export const Mode = z.object({
	id: z.int(),
	name: z.string(),
	/**
	 * Note the spelling: the API sends `desciption`, not `description`. The key is kept
	 * verbatim so parsing does not silently drop it.
	 */
	desciption: z.string(),
})
export type Mode = z.infer<typeof Mode>

/** `GET /api/mode` */
export const GetModesResponse = z.array(Mode)
export type GetModesResponse = z.infer<typeof GetModesResponse>

/** `PUT /api/mode/{id}` — path parameters. Selects the active mode. */
export const SetModeParams = z.object({
	id: z.int(),
})
export type SetModeParams = z.infer<typeof SetModeParams>

/**
 * `PUT /api/mode/{id}`
 *
 * Takes no request body. The OpenAPI document describes the response only as `200 OK`;
 * this endpoint mutates live displays so it was not exercised to discover the body.
 */
export const SetModeResponse = UnknownResponse
export type SetModeResponse = z.infer<typeof SetModeResponse>
