import type { DropdownChoice } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type ActionsSchema = {
	set_mode: {
		options: {
			mode: number
		}
	}
	message: {
		options: {
			method: 'show' | 'hide'
			group: number
			message: number
		}
	}
}

const methodChoices = [
	{ id: 'show', label: 'Show' },
	{ id: 'hide', label: 'Hide' },
] as const satisfies DropdownChoice<'show' | 'hide'>[]

export function UpdateActions(self: ModuleInstance): void {
	const modeChoices = self.getModeChoices()
	const groupChoices = self.getGroupChoices()
	const messageChoices = self.getMessageChoices()

	self.setActionDefinitions({
		set_mode: {
			name: 'Set Mode',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: modeChoices,
					default: modeChoices[0]?.id ?? 0,
					expressionDescription: describeIdChoices(modeChoices, 'modes'),
				},
			],
			callback: async (event, context) => {
				await self.sendMsg({ endpoint: 'setMode', params: { id: event.options.mode } }, context.signal)
			},
		},
		message: {
			name: 'Show/Hide Message',
			options: [
				{
					id: 'method',
					type: 'dropdown',
					label: 'Method',
					choices: methodChoices,
					default: 'show',
					expressionDescription: `Accepted values: ${methodChoices.map((choice) => `'${choice.id}'`).join(', ')}`,
					disableAutoExpression: true,
				},
				{
					id: 'group',
					type: 'dropdown',
					label: 'Group',
					choices: groupChoices,
					default: groupChoices[0]?.id ?? 0,
					expressionDescription: describeIdChoices(groupChoices, 'groups'),
				},
				{
					id: 'message',
					type: 'dropdown',
					label: 'Message',
					choices: messageChoices,
					default: messageChoices[0]?.id ?? 0,
					description: 'Ignored when the method is Hide',
					expressionDescription: describeIdChoices(messageChoices, 'messages'),
					isVisibleExpression: '$(options:method) == "show"',
				},
			],
			callback: async (event, context) => {
				const { method, group, message } = event.options

				// Hiding clears whatever the group is showing, so it takes no message id
				if (method === 'hide') {
					await self.sendMsg({ endpoint: 'hideMessage', params: { groupId: group } }, context.signal)
					return
				}

				await self.sendMsg({ endpoint: 'showMessage', params: { groupId: group, messageId: message } }, context.signal)
			},
		},
	})
}

/** The values an id dropdown will accept once it is in expression mode. */
function describeIdChoices(choices: DropdownChoice<number>[], noun: string): string {
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
