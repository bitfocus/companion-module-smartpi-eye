import type ModuleInstance from './main.js'
import type { GetIngesterJobsResponse } from './schemas/index.js'

export type VariablesSchema = {
	id: string
	status: string
	ingester_jobs: GetIngesterJobsResponse
	/** Count of jobs per `jobStatus`, e.g. `{ Started: 20, Stopped: 2 }`. */
	ingester_jobs_summary: Record<string, number>
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		id: { name: 'Device ID' },
		status: { name: 'Device Status' },
		ingester_jobs: { name: 'Ingester Jobs' },
		ingester_jobs_summary: { name: 'Ingester Jobs Summary' },
	})
}
