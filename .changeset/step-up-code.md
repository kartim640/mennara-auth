---
"@mennara/auth": patch
---

`isStepUpRequiredError` uses Identity's `step_up_required` error code when present, and falls back to the message text for Identity versions without codes.
