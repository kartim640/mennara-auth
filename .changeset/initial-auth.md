---
"@mennara/auth": minor
---

Initial auth package. Root entry: session-bound CSRF store, cross-tab session channel, and safe login redirects. `./identity` entry: the Identity browser client moved from `@mennara/identity-client`, now built on `@mennara/http` (`IdentityRequestError` extends `HttpError`; network failures and timeouts reject with status 0).
