export type BrowserAccountState = "authenticated" | "sign_in_required"

export interface BrowserAccount {
  public_account_id: string
  display_name: string | null
  email_hint: string | null
  state: BrowserAccountState
  current: boolean
}

export interface BrowserAccountsResponse {
  selection_version: number
  csrf_token?: string | null
  current_account: BrowserAccount | null
  accounts: BrowserAccount[]
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function isBrowserAccount(value: unknown): value is BrowserAccount {
  if (!isRecord(value)) return false

  return (
    typeof value.public_account_id === "string" &&
    (typeof value.display_name === "string" || value.display_name === null) &&
    (typeof value.email_hint === "string" || value.email_hint === null) &&
    (value.state === "authenticated" || value.state === "sign_in_required") &&
    typeof value.current === "boolean"
  )
}

export function isBrowserAccountsResponse(value: unknown): value is BrowserAccountsResponse {
  if (!isRecord(value)) return false

  const csrfTokenValid =
    value.csrf_token === undefined || value.csrf_token === null || typeof value.csrf_token === "string"

  return (
    Number.isInteger(value.selection_version) &&
    Number(value.selection_version) >= 0 &&
    csrfTokenValid &&
    (value.current_account === null || isBrowserAccount(value.current_account)) &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isBrowserAccount)
  )
}
