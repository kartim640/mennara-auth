import { describe, expect, it } from "vitest"

import { getLoginUrl, getSafeReturnPath } from "../src"

describe("getSafeReturnPath", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["https://evil.example/x", "/"],
    ["//evil.example/x", "/"],
    ["/\\evil.example/x", "/"],
    ["relative", "/"],
    ["/users?page=2", "/users?page=2"],
  ])("%j → %j", (value, expected) => {
    expect(getSafeReturnPath(value)).toBe(expected)
  })

  it("blocks configured prefixes and uses the fallback", () => {
    expect(getSafeReturnPath("/api/auth/logout", { blockedPrefixes: ["/api/auth/"] })).toBe("/")
    expect(getSafeReturnPath("bad", { fallback: "/home" })).toBe("/home")
  })
})

describe("getLoginUrl", () => {
  it("defaults to the current page as the return path", () => {
    window.history.replaceState(null, "", "/users?page=2")
    const url = new URL(getLoginUrl())

    expect(url.pathname).toBe("/api/auth/login")
    expect(url.searchParams.get("return_to")).toBe("/users?page=2")
  })

  it("accepts a custom login path, parameter and return path, and keeps it safe", () => {
    const url = new URL(getLoginUrl({ loginPath: "/login", returnParam: "next", returnTo: "//evil.example" }))

    expect(url.origin).toBe(window.location.origin)
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe("/")
  })
})
