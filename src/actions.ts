import type { DropdownChoice } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { describeIdChoices } from './options.js'

export enum ActionIDs {
	SetMode = 'set_mode',
	Message = 'message',
}

export type ActionsSchema = {
	[ActionIDs.SetMode]: {
		options: {
			mode: number
		}
	}
	[ActionIDs.Message]: {
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
] as const satisfies readonly DropdownChoice<'show' | 'hide'>[]

export function UpdateActions(self: ModuleInstance): void {
	const modeChoices = self.getModeChoices()
	const groupChoices = self.getGroupChoices()
	const messageChoices = self.getMessageChoices()

	self.setActionDefinitions({
		[ActionIDs.SetMode]: {
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
		[ActionIDs.Message]: {
			name: 'Show/Hide Message',
			options: [
				{
					id: 'method',
					type: 'dropdown',
					label: 'Method',
					choices: [...methodChoices],
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
