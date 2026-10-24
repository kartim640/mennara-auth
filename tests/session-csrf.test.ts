import { describe, expect, it, vi } from "vitest"

import { createSessionCsrf } from "../src"

describe("createSessionCsrf", () => {
  it("fetches once, caches, and shares concurrent first calls", async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetchProof = vi.fn(async () => {
      await gate
      return { token: "t1", userId: "A" }
    })
    const csrf = createSessionCsrf({ fetchProof })

    const first = Promise.all([csrf.getToken(), csrf.getToken()])
    release?.()
    expect(await first).toEqual(["t1", "t1"])
    expect(await csrf.getToken()).toBe("t1")
    expect(fetchProof).toHaveBeenCalledOnce()
  })

  it("fetches again after clear and bumps the generation", async () => {
    let n = 0
    const csrf = createSessionCsrf({ fetchProof: () => Promise.resolve({ token: `t${++n}`, userId: "A" }) })

    expect(await csrf.getToken()).toBe("t1")
    const before = csrf.generation()
    csrf.clear()
    expect(csrf.generation()).toBe(before + 1)
    expect(await csrf.getToken()).toBe("t2")
  })

  it("drops a token whose fetch overlapped a clear", async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const csrf = createSessionCsrf({
      fetchProof: async () => {
        await gate
        return { token: "old", userId: "A" }
      },
      sessionChangedMessage: "Console session changed",
    })

    const pending = csrf.getToken()
    csrf.clear()
    release?.()
    await expect(pending).rejects.toThrow("Console session changed")
  })

  it("refuses a token for another account than the bound one", async () => {
    const csrf = createSessionCsrf({ fetchProof: () => Promise.resolve({ token: "t", userId: "B" }) })
    csrf.bindIdentity("A")

    await expect(csrf.getToken()).rejects.toThrow("session changed")
    expect(() => csrf.bindIdentity("B")).toThrow("session changed")
  })

  it("refuses an empty proof", async () => {
    const csrf = createSessionCsrf({ fetchProof: () => Promise.resolve({ token: "", userId: "A" }) })
    await expect(csrf.getToken()).rejects.toThrow("session changed")
  })

  it("invalidates only the token that was rejected", async () => {
    let n = 0
    const csrf = createSessionCsrf({ fetchProof: () => Promise.resolve({ token: `t${++n}`, userId: "A" }) })
    await csrf.getToken()

    csrf.invalidate("stale")
    expect(await csrf.getToken()).toBe("t1")
    csrf.invalidate("t1")
    expect(await csrf.getToken()).toBe("t2")
  })
})
