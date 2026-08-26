import type ModuleInstance from './main.js'

export type VariablesSchema = {
	id: string
	status: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		id: { name: 'Device ID' },
		status: { name: 'Device Status' },
	})
}
