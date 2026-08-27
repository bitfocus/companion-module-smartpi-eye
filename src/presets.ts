import type { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import { presetDefaults } from './consts.js'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import { ActionIDs } from './actions.js'
import { FeedbackIDs } from './feedbacks.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	const modeGroups: CompanionPresetGroup<ModuleSchema>[] = []
	const structure: CompanionPresetSection[] = [
		{
			id: 'section1',
			name: 'Modes',
			definitions: modeGroups,
		},
	]

	// One template: the group below stamps out a button per discovered mode, each with its own
	// `mode` local variable. Both the action and the name lookup read that one variable, so
	// repointing a copied button is a single edit.
	presets[`set_mode_template`] = {
		type: 'simple',
		name: `Set Mode`,
		style: {
			...presetDefaults.style,
			text: `$(local:name)`,
			size: 'auto',
		},
		localVariables: [
			{ variableType: 'simple', variableName: 'mode', startupValue: 1 },
			{
				variableType: 'feedback',
				variableName: 'name',
				feedbackId: FeedbackIDs.GetName,
				options: {
					property: 'mode',
					mode: { isExpression: true, value: '$(local:mode)' },
					group: 0,
					message: 0,
				},
			},
		],
		steps: [
			{
				down: [
					{
						actionId: ActionIDs.SetMode,
						options: {
							mode: { isExpression: true, value: '$(local:mode)' },
						},
						delay: 0,
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	modeGroups.push({
		id: `set_mode`,
		name: 'Set Mode',
		type: 'template',
		presetId: 'set_mode_template',
		templateVariableName: 'mode',
		templateValues: self.getModeChoices().map((mode) => ({
			name: `Set Mode ${mode.label}`,
			value: mode.id,
		})),
	})

	self.setPresetDefinitions(structure, presets)
}
