import { createHttpClient, type HttpRequestOptions } from "@mennara/http"

import { isBrowserAccountsResponse, isRecord, type BrowserAccountsResponse } from "./browser-accounts"
import { IdentityRequestError } from "./errors"

export interface IdentityRequestOptions {
  method?: string
  // JSON-serializable value, or FormData for file uploads.
  body?: unknown
  timeoutMs?: number
  credentials?: RequestCredentials
  // Sends the observed selection version so Identity rejects requests made for a stale account.
  accountScoped?: boolean
}

export interface IdentityClientOptions {
  apiUrl: string
  timeoutMs?: number
  // Required for accountScoped requests; return null when no account context has been observed.
  getSelectionVersion?: () => number | null
  // Called when the selected account changed underneath the page.
  onAccountContextChanged?: (state: BrowserAccountsResponse | null) => void
}

export interface IdentityClient {
  request<T>(path: string, options?: IdentityRequestOptions): Promise<T>
  setCsrfToken(token: string | null | undefined): void
  clearCsrfToken(): void
}

/**
 * Creates a client for Identity's browser API.
 *
 * Requests use Identity's HttpOnly browser session. Unsafe requests carry the
 * session-bound CSRF token; no bearer credential is injected.
 */
export function createIdentityClient(options: IdentityClientOptions): IdentityClient {
  let csrfToken: string | null = null

  const accountContextChanged = (state: BrowserAccountsResponse | null) => {
    options.onAccountContextChanged?.(state)
  }

  const http = createHttpClient({
    baseUrl: options.apiUrl,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    csrf: { getToken: () => csrfToken },
    onError: (_context, error) => {
      const state = isRecord(error.body) && isBrowserAccountsResponse(error.body.state) ? error.body.state : null
      const identityError = new IdentityRequestError(
        error.message,
        error.status,
        error.code,
        error.details,
        state,
        error.body,
        { cause: error.cause ?? error },
      )
      if (identityError.code === "account_context_changed") accountContextChanged(state)
      throw identityError
    },
  })

  function request<T>(path: string, requestOptions: IdentityRequestOptions = {}): Promise<T> {
    const { accountScoped, ...rest } = requestOptions
    const httpOptions: HttpRequestOptions = { ...rest }

    if (accountScoped) {
      const selectionVersion = options.getSelectionVersion?.() ?? null
      if (selectionVersion === null) {
        accountContextChanged(null)
        return Promise.reject(
          new IdentityRequestError(
            "Confirm the selected account before continuing.",
            409,
            "account_context_changed",
          ),
        )
      }
      httpOptions.headers = { "x-mennara-selection-version": String(selectionVersion) }
    }

    return http.request<T>(path, httpOptions)
  }

  return {
    request,
    setCsrfToken(token) {
      csrfToken = token || null
    },
    clearCsrfToken() {
      csrfToken = null
    },
  }
}
