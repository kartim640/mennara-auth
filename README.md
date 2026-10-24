# @mennara/auth

Sign-in plumbing shared by Mennara browser apps. It decides nothing about domains or screens.

## Entry points

### `@mennara/auth`: every app

For apps that sign in through their own backend (BFF), such as Console and future apps:

- `createSessionCsrf`: one session-bound CSRF token per page, fetched once, never mixed across sessions or accounts
- `createSessionChannel`: a cross-tab "session changed" signal for sign-out and account switches
- `getSafeReturnPath`, `getLoginUrl`, `redirectToLogin`: send the user to the backend's login route with a same-origin return path

```ts
import { createSessionChannel, createSessionCsrf, redirectToLogin } from "@mennara/auth"
import { createHttpClient } from "@mennara/http"

const sessionApi = createHttpClient({ baseUrl: "/api/app/session" })

export const csrf = createSessionCsrf({
  fetchProof: async () => {
    const data = await sessionApi.get<{ csrf_token: string; identity_user_id: string }>("/csrf")
    return { token: data.csrf_token, userId: data.identity_user_id }
  },
})

export const session = createSessionChannel("app-session-transition", { onTransition: csrf.clear })

redirectToLogin({ blockedPrefixes: ["/api/auth/"] })
```

### `@mennara/auth/identity`: Account and MyAccount only

Identity's own browser API: the request client (browser-session credentials, CSRF on unsafe methods, selection-version headers), `IdentityRequestError`, browser-account validation, passkey (WebAuthn) conversion and the shared Identity endpoints. It is built on `@mennara/http`; `IdentityRequestError` extends `HttpError`.

Other apps must not import it: they never call Identity from the browser. Enforce this with ESLint `no-restricted-imports`.

## What does not belong here

- React components or hooks, routing, and UI copy (`@mennara/ui`, the app)
- Business endpoints (`@mennara/api`)
- Reading `process.env`
