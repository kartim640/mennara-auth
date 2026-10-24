import { HttpError } from "@mennara/http"

import type { BrowserAccountsResponse } from "./browser-accounts"

export class IdentityRequestError extends HttpError {
  constructor(
    message: string,
    status: number,
    code: string | null = null,
    details: Readonly<Record<string, unknown>> | null = null,
    // The server's browser-account state, when it sends a valid one.
    public readonly state: BrowserAccountsResponse | null = null,
    body: unknown = null,
    options?: ErrorOptions,
  ) {
    super(message, status, code, details, body, options)
    this.name = "IdentityRequestError"
  }
}

export function isStepUpRequiredError(error: unknown): error is IdentityRequestError {
  return (
    error instanceof IdentityRequestError &&
    error.status === 401 &&
    error.message.toLowerCase().includes("step-up verification required")
  )
}
