import { z } from 'zod'
import { DotNetDateTime } from './common.js'

/** Tag: `ApiIngesterJobs` */

/** A scheduled job hosted by an ingester, e.g. `LogRotationJob`, `RealtimeCleaner_16`. */
export const IngesterJob = z.object({
	jobName: z.string(),
	/** Scheduler state. Observed: `'Started'`, `'Stopped'`. */
	jobStatus: z.string(),
	/** When the job entered {@link IngesterJob.jobStatus}. */
	jobStatusTime: DotNetDateTime,
	/** Outcome of the most recent execution. Observed: `'Completed'`, `'In Progress'`, `'Failed'`. */
	lastRunStatus: z.string(),
	lastRunTime: DotNetDateTime,
})
export type IngesterJob = z.infer<typeof IngesterJob>

/** `GET /api/ingester/jobs` */
export const GetIngesterJobsResponse = z.array(IngesterJob)
export type GetIngesterJobsResponse = z.infer<typeof GetIngesterJobsResponse>
