import type { DropdownChoice } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { NameProperty } from './main.js'
import { describeIdChoices } from './options.js'

export enum FeedbackIDs {
	GetName = 'get_name',
}

export type FeedbacksSchema = {
	[FeedbackIDs.GetName]: {
		type: 'value'
		options: {
			property: NameProperty
			mode: number
			group: number
			message: number
		}
	}
}

const propertyChoices = [
	{ id: 'mode', label: 'Mode' },
	{ id: 'group', label: 'Group' },
	{ id: 'message', label: 'Message' },
] as const satisfies readonly DropdownChoice<NameProperty>[]

export function UpdateFeedbacks(self: ModuleInstance): void {
	const modeChoices = self.getModeChoices()
	const groupChoices = self.getGroupChoices()
	const messageChoices = self.getMessageChoices()

	self.setFeedbackDefinitions({
		[FeedbackIDs.GetName]: {
			type: 'value',
			name: 'Get Name',
			description: 'The name of the selected mode, group or message',
			options: [
				{
					id: 'property',
					type: 'dropdown',
					label: 'Property',
					choices: [...propertyChoices],
					default: propertyChoices[0].id,
					disableAutoExpression: true,
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: modeChoices,
					default: modeChoices[0]?.id ?? 0,
					expressionDescription: describeIdChoices(modeChoices, 'modes'),
					isVisibleExpression: '$(options:property) == "mode"',
				},
				{
					id: 'group',
					type: 'dropdown',
					label: 'Group',
					choices: groupChoices,
					default: groupChoices[0]?.id ?? 0,
					expressionDescription: describeIdChoices(groupChoices, 'groups'),
					isVisibleExpression: '$(options:property) == "group"',
				},
				{
					id: 'message',
					type: 'dropdown',
					label: 'Message',
					choices: messageChoices,
					default: messageChoices[0]?.id ?? 0,
					expressionDescription: describeIdChoices(messageChoices, 'messages'),
					isVisibleExpression: '$(options:property) == "message"',
				},
			],
			callback: (feedback) => {
				const { property } = feedback.options

				// `property` names both the list to search and the option holding the id
				return self.getName(property, feedback.options[property]) ?? ''
			},
		},
	})
}
