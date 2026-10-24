import { HttpError } from "@mennara/http"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createIdentityClient, IdentityRequestError, isStepUpRequiredError } from "../../src/identity"

const state = { selection_version: 3, csrf_token: null, current_account: null, accounts: [] }

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] ?? []
  return { url, init: init!, headers: init!.headers as Record<string, string> }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("createIdentityClient", () => {
  it("joins the API URL and path and sends the browser session", async () => {
    const fetchMock = mockFetch(Response.json({ ok: true }))
    const client = createIdentityClient({ apiUrl: "https://id.example/api/" })

    await expect(client.request("v1/auth/me")).resolves.toEqual({ ok: true })

    const { url, init } = sentRequest(fetchMock)
    expect(url).toBe("https://id.example/api/v1/auth/me")
    expect(init.credentials).toBe("include")
    expect(init.method).toBe("GET")
  })

  it("sends the CSRF token only on unsafe methods", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }))
    const client = createIdentityClient({ apiUrl: "https://id.example" })
    client.setCsrfToken("token-1")

    await client.request("/a")
    expect(sentRequest(fetchMock).headers["x-csrf-token"]).toBeUndefined()

    fetchMock.mockClear()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await client.request("/a", { method: "post", body: { name: "x" } })
    const { headers, init } = sentRequest(fetchMock)
    expect(headers["x-csrf-token"]).toBe("token-1")
    expect(headers["content-type"]).toBe("application/json")
    expect(init.body).toBe('{"name":"x"}')

    client.clearCsrfToken()
    fetchMock.mockClear()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await client.request("/a", { method: "DELETE" })
    expect(sentRequest(fetchMock).headers["x-csrf-token"]).toBeUndefined()
  })

  it("sends FormData without a JSON content type", async () => {
    const fetchMock = mockFetch(Response.json({ id: "u1" }))
    const client = createIdentityClient({ apiUrl: "https://id.example" })
    client.setCsrfToken("token-1")
    const form = new FormData()
    form.append("file", new Blob(["x"]), "avatar.png")

    await client.request("/avatar", { method: "POST", body: form })

    const { headers, init } = sentRequest(fetchMock)
    expect(init.body).toBe(form)
    expect(headers["content-type"]).toBeUndefined()
    expect(headers["x-csrf-token"]).toBe("token-1")
  })

  it("keeps CSRF tokens separate per client", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }))
    const first = createIdentityClient({ apiUrl: "https://id.example" })
    const second = createIdentityClient({ apiUrl: "https://id.example" })
    first.setCsrfToken("first")

    await second.request("/a", { method: "POST" })
    expect(sentRequest(fetchMock).headers["x-csrf-token"]).toBeUndefined()
  })

  it("returns undefined for empty successful bodies", async () => {
    mockFetch(new Response("", { status: 200 }))
    const client = createIdentityClient({ apiUrl: "https://id.example" })

    await expect(client.request("/a")).resolves.toBeUndefined()
  })

  it("adds the selection version to account-scoped requests", async () => {
    const fetchMock = mockFetch(Response.json({}))
    const client = createIdentityClient({ apiUrl: "https://id.example", getSelectionVersion: () => 7 })

    await client.request("/a", { accountScoped: true })
    expect(sentRequest(fetchMock).headers["x-mennara-selection-version"]).toBe("7")
  })

  it("refuses account-scoped requests without an observed account", async () => {
    const fetchMock = mockFetch(Response.json({}))
    const onAccountContextChanged = vi.fn()
    const client = createIdentityClient({
      apiUrl: "https://id.example",
      getSelectionVersion: () => null,
      onAccountContextChanged,
    })

    const error = await client.request("/a", { accountScoped: true }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(IdentityRequestError)
    expect(error).toMatchObject({ status: 409, code: "account_context_changed" })
    expect(onAccountContextChanged).toHaveBeenCalledWith(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("parses the error envelope and reports account changes with server state", async () => {
    mockFetch(Response.json(
      { error: { code: "account_context_changed", message: "Account changed", details: { field: "x" } }, state },
      { status: 409 },
    ))
    const onAccountContextChanged = vi.fn()
    const client = createIdentityClient({ apiUrl: "https://id.example", onAccountContextChanged })

    const error = await client.request("/a").catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      message: "Account changed",
      status: 409,
      code: "account_context_changed",
      details: { field: "x" },
      state,
    })
    expect(onAccountContextChanged).toHaveBeenCalledWith(state)
  })

  it.each([
    [{ detail: "Bad password" }, "Bad password"],
    [{ detail: [{ msg: "Field required" }, { message: "Too short" }] }, "Field required, Too short"],
    [{ message: "Plain message" }, "Plain message"],
    [{ error: "String error" }, "String error"],
  ])("reads error detail from %j", async (body, message) => {
    mockFetch(Response.json(body, { status: 400 }))
    const client = createIdentityClient({ apiUrl: "https://id.example" })

    await expect(client.request("/a")).rejects.toMatchObject({ message, status: 400, code: null })
  })

  it("falls back to a status message for non-JSON errors and ignores invalid state", async () => {
    mockFetch(new Response("<html>", { status: 502 }))
    const client = createIdentityClient({ apiUrl: "https://id.example" })

    await expect(client.request("/a")).rejects.toMatchObject({ message: "Request failed with 502", state: null })
  })

  it("times out slow requests", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    }))
    const client = createIdentityClient({ apiUrl: "https://id.example", timeoutMs: 10 })

    await expect(client.request("/a")).rejects.toThrow("Request timed out")
  })
})

describe("built on @mennara/http", () => {
  it("throws IdentityRequestError, which is also an HttpError, for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")))
    const client = createIdentityClient({ apiUrl: "https://id.example" })

    const error = await client.request("/a").catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(IdentityRequestError)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 0, code: "network_error", state: null })
  })
})

describe("isStepUpRequiredError", () => {
  it("matches 401 step-up responses only", () => {
    expect(isStepUpRequiredError(new IdentityRequestError("Step-up verification required", 401))).toBe(true)
    expect(isStepUpRequiredError(new IdentityRequestError("Unauthorized", 401))).toBe(false)
    expect(isStepUpRequiredError(new Error("Step-up verification required"))).toBe(false)
  })
})
