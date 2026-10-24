import { describe, expect, it, vi } from "vitest"

import { createIdentityEndpoints, normalizeStepUpMethods } from "../../src/identity"
import type { IdentityClient, IdentityRequestOptions } from "../../src/identity"

type RequestCall = { path: string; options: IdentityRequestOptions }

function fakeClient(result: unknown = undefined): { client: IdentityClient; calls: RequestCall[] } {
  const calls: RequestCall[] = []
  const client: IdentityClient = {
    request: vi.fn((path: string, options: IdentityRequestOptions = {}) => {
      calls.push({ path, options })
      return Promise.resolve(result)
    }) as IdentityClient["request"],
    setCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  }
  return { client, calls }
}

describe("createIdentityEndpoints", () => {
  it("sends account-scoped reads for profile and security data", async () => {
    const { client, calls } = fakeClient()
    const api = createIdentityEndpoints(client)

    await api.me()
    await api.sessions()
    await api.loginMethods()

    expect(calls.map((c) => c.path)).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/sessions",
      "/api/v1/auth/login-methods",
    ])
    expect(calls.every((c) => c.options.accountScoped)).toBe(true)
    expect(calls.every((c) => c.options.method === undefined)).toBe(true)
  })

  it("maps reset and unlink arguments onto the request body and path", async () => {
    const { client, calls } = fakeClient()
    const api = createIdentityEndpoints(client)

    await api.resetPassword("tok", "s3cret")
    await api.unlinkLoginMethod("method/id")

    const [reset, unlink] = calls
    expect(reset).toMatchObject({
      path: "/api/v1/auth/reset-password",
      options: { method: "POST", body: { token: "tok", new_password: "s3cret" } },
    })
    expect(unlink?.path).toBe("/api/v1/auth/login-methods/method%2Fid")
    expect(unlink?.options.method).toBe("DELETE")
  })

  it("posts the sign-out scopes as account-scoped writes", async () => {
    const { client, calls } = fakeClient()
    const api = createIdentityEndpoints(client)

    await api.logoutOtherDevices()
    await api.signOutEverywhere()

    expect(calls.map((c) => c.path)).toEqual([
      "/api/v1/auth/logout-other-devices",
      "/api/v1/auth/sessions/sign-out-everywhere",
    ])
    expect(calls.every((c) => c.options.method === "POST" && c.options.accountScoped)).toBe(true)
  })

  it("normalizes the step-up methods response", async () => {
    const { client } = fakeClient({ methods: ["passkey", "totp", "backup_code", "oauth:google"] })
    const api = createIdentityEndpoints(client)

    await expect(api.stepUpMethods()).resolves.toEqual({
      available_methods: ["passkey", "mfa", "oauth"],
      recommended_method: "passkey",
      oauth_providers: ["google"],
    })
  })
})

describe("normalizeStepUpMethods", () => {
  it("tolerates a missing methods array", () => {
    expect(normalizeStepUpMethods({})).toEqual({
      available_methods: [],
      recommended_method: null,
      oauth_providers: [],
    })
  })

  it("de-duplicates methods and collects every oauth provider", () => {
    expect(normalizeStepUpMethods({ methods: ["totp", "backup_code", "oauth:google", "oauth:github"] })).toEqual({
      available_methods: ["mfa", "oauth"],
      recommended_method: "mfa",
      oauth_providers: ["google", "github"],
    })
  })
})
