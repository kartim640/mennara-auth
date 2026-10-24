import { describe, expect, it } from "vitest"

import { isBrowserAccount, isBrowserAccountsResponse } from "../../src/identity"

const account = { public_account_id: "a1", display_name: "Jordan", email_hint: "j***@example.com", state: "authenticated", current: true }

describe("browser account validation", () => {
  it("accepts well-formed state", () => {
    expect(isBrowserAccount(account)).toBe(true)
    expect(isBrowserAccountsResponse({ selection_version: 0, current_account: account, accounts: [account] })).toBe(true)
    expect(isBrowserAccountsResponse({ selection_version: 2, csrf_token: "t", current_account: null, accounts: [] })).toBe(true)
  })

  it.each([
    ["negative version", { selection_version: -1, current_account: null, accounts: [] }],
    ["fractional version", { selection_version: 1.5, current_account: null, accounts: [] }],
    ["numeric csrf token", { selection_version: 1, csrf_token: 5, current_account: null, accounts: [] }],
    ["unknown account state", { selection_version: 1, current_account: null, accounts: [{ ...account, state: "locked" }] }],
    ["missing accounts", { selection_version: 1, current_account: null }],
    ["array", []],
  ])("rejects %s", (_name, value) => {
    expect(isBrowserAccountsResponse(value)).toBe(false)
  })
})
