import { z } from 'zod'
import { AlarmFlag, UnixSeconds } from './common.js'

/** Tag: `ApiMonitoring` */

/**
 * Fields whose live value was `null` in every sample, so the non-null type is inferred
 * rather than observed. Accepts either a number or a string to avoid rejecting a reading
 * once hardware starts reporting one.
 */
const UnobservedReading = z.union([z.number(), z.string()]).nullable()

/** Sensor readings shared by {@link DeviceHistory} and {@link DeviceStatus}. */
const DeviceReadings = z.object({
	deviceId: z.int(),
	/** Unix epoch seconds — note this differs from the ISO timestamps used elsewhere. */
	statusTime: UnixSeconds,
	/** Temperature in °C. */
	temp: z.number().nullable(),
	tempAlarm: AlarmFlag,
	photocellLevel: UnobservedReading,
	photocellLevelAlarm: AlarmFlag,
	/** PSU rail voltages arrive as strings (`'12'`), and as `''` when unreported. */
	psu5v: z.string().nullable(),
	psu5vAlarm: AlarmFlag,
	psu12v: z.string().nullable(),
	psu12vAlarm: AlarmFlag,
	psu24v: z.string().nullable(),
	psu24vAlarm: AlarmFlag,
	fanSpeedInternal: UnobservedReading,
	fanSpeedInternalAlarm: AlarmFlag,
	fanSpeedExternal: UnobservedReading,
	fanSpeedExternalAlarm: AlarmFlag,
})
export type DeviceReadings = z.infer<typeof DeviceReadings>

/** A historical sample of {@link DeviceReadings}, carrying its own row id. */
export const DeviceHistory = DeviceReadings.extend({
	id: z.int(),
})
export type DeviceHistory = z.infer<typeof DeviceHistory>

/**
 * The device's most recent readings, plus the control-surface state it reports back.
 * Distinct from {@link DeviceControl}, which is the *requested* state.
 */
export const DeviceStatus = DeviceReadings.extend({
	manufacturer: z.string().nullable(),
	/** Observed: `'on'`. */
	powerState: z.string().nullable(),
	/** Observed: `'on'`. */
	remoteControl: z.string().nullable(),
	/** Observed: `'hdmi'`. */
	inputSource: z.string().nullable(),
	/** Observed: `'off'`. */
	fans: z.string().nullable(),
	/** Observed: `'low'`. */
	lightSensorMode: z.string().nullable(),
})
export type DeviceStatus = z.infer<typeof DeviceStatus>

/** Requested control state for a device. Every field is `null` until it has been set. */
export const DeviceControl = z.object({
	deviceId: z.int(),
	/** Unix epoch seconds at which the control values were applied. */
	timeSet: UnixSeconds,
	powerState: z.string().nullable(),
	remoteControl: z.string().nullable(),
	inputSource: z.string().nullable(),
	fans: z.string().nullable(),
	lightSensorMode: z.string().nullable(),
})
export type DeviceControl = z.infer<typeof DeviceControl>

/**
 * A monitored device.
 *
 * The list endpoint returns a summary projection: `deviceControl` and `deviceStatus` are
 * `null` and `deviceHistories` is empty even for devices that have data. Fetch a single
 * device by uid to get those populated.
 */
export const Device = z.object({
	uid: z.int(),
	pidName: z.string(),
	/** Vendor device identifier as a string, e.g. `'1769591857'`. Empty when unassigned. */
	deviceId: z.string(),
	/** Observed: `'display'`. */
	deviceType: z.string(),
	model: z.string(),
	firmwareVersion: z.string(),
	deviceControl: DeviceControl.nullable(),
	deviceHistories: z.array(DeviceHistory),
	deviceStatus: DeviceStatus.nullable(),
})
export type Device = z.infer<typeof Device>

/** `GET /api/monitoring/devices` */
export const GetDevicesResponse = z.array(Device)
export type GetDevicesResponse = z.infer<typeof GetDevicesResponse>

/** `GET /api/monitoring/devices/{uid}` — path parameters. */
export const GetDeviceParams = z.object({
	uid: z.int(),
})
export type GetDeviceParams = z.infer<typeof GetDeviceParams>

/**
 * `GET /api/monitoring/devices/{uid}`
 *
 * Returns `404` with a `ProblemDetails` body for an unknown uid. `deviceHistories` is
 * unbounded — a single device returned ~1.3 MB of history in testing.
 */
export const GetDeviceResponse = Device
export type GetDeviceResponse = z.infer<typeof GetDeviceResponse>
