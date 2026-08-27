## SmartPI EYE

### Actions

| Action            | Options                            |
| ----------------- | ---------------------------------- |
| Set Mode          | Mode                               |
| Show/Hide Message | Method (Show/Hide), Group, Message |

### Feedbacks

| Feedback | Returns                                         |
| -------- | ----------------------------------------------- |
| Get Name | The name of the selected mode, group or message |

### Variables

| Variable                               | Value                                                     |
| -------------------------------------- | --------------------------------------------------------- |
| `$(smartpi-eye:id)`                    | Device ID reported by the surface                         |
| `$(smartpi-eye:status)`                | Device status, e.g. `Ok`                                  |
| `$(smartpi-eye:ingester_jobs)`         | Full list of ingester jobs                                |
| `$(smartpi-eye:ingester_jobs_summary)` | Job counts per status, e.g. `{ Started: 18, Stopped: 4 }` |

### Presets

| Preset   | Function                                                                  |
| -------- | ------------------------------------------------------------------------- |
| Set Mode | One button per mode. Sets the mode, and shows its name as the button text |
