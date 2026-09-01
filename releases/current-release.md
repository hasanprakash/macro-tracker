# Release Notes

- Fixed Health Connect future date queries crashing due to invalid time ranges.
- Prevented spurious redirection to Android Health Connect settings when permissions are already granted.
- Fixed calorie burn count desync caused by background steps sync running with stale dates.
- Resolved month skipping in calendar navigation when navigating forward from 31-day months (e.g. Aug 31 to Oct).
- Fixed CountingNumber animation freeze bug in Daily Summary Card where burned calories became stuck on partial values.
- Fixed date transition animation jumping by smoothly interpolating rings and macro bars between dates with full rotary haptics.
