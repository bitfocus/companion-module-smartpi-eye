import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection[] = []

	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	self.setPresetDefinitions(structure, presets)
}
