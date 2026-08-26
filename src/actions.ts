import type ModuleInstance from './main.js'

export type ActionsSchema = {
	set_mode: {
		options: {
			mode: number
		}
	}
}

export function UpdateActions(self: ModuleInstance): void {
	const choices = self.getModeChoices()

	self.setActionDefinitions({
		set_mode: {
			name: 'Set Mode',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices,
					default: choices[0]?.id ?? 0,
					expressionDescription:
						choices.length > 0
							? `Accepted values: ${formatIdRanges(choices.map((choice) => choice.id))}`
							: 'No modes have been read from the device yet',
				},
			],
			callback: async (event, context) => {
				await self.sendMsg({ endpoint: 'setMode', params: { id: event.options.mode } }, context.signal)
			},
		},
	})
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
