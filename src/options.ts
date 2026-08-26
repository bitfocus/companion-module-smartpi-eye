import type { DropdownChoice } from '@companion-module/base'

/**
 * Option helpers shared by actions and feedbacks, so an id dropdown is presented the same
 * way wherever it appears.
 */

/** The values an id dropdown will accept once it is in expression mode. */
export function describeIdChoices(choices: DropdownChoice<number>[], noun: string): string {
	if (choices.length === 0) return `No ${noun} have been read from the device yet`

	return `Accepted values: ${formatIdRanges(choices.map((choice) => choice.id))}`
}

/**
 * Collapses a set of ids into the shortest readable form: runs of consecutive ids become
 * `min-max`, isolated ids are listed on their own — `1-5, 7, 11-14`.
 */
function formatIdRanges(ids: number[]): string {
	const sorted = [...new Set(ids)].sort((a, b) => a - b)
	if (sorted.length === 0) return ''

	const parts: string[] = []
	let start = sorted[0]
	let end = start

	for (const id of sorted.slice(1)) {
		if (id === end + 1) {
			end = id
			continue
		}

		parts.push(start === end ? `${start}` : `${start}-${end}`)
		start = id
		end = id
	}
	parts.push(start === end ? `${start}` : `${start}-${end}`)

	return parts.join(', ')
}
