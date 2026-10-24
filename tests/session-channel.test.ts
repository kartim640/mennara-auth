import { afterEach, describe, expect, it, vi } from "vitest"

import { createSessionChannel } from "../src"

afterEach(() => vi.unstubAllGlobals())

describe("createSessionChannel", () => {
  it("tells watchers in this tab and runs onTransition first", () => {
    const order: string[] = []
    const channel = createSessionChannel("test-session", { onTransition: () => order.push("clear") })
    const stop = channel.watch(() => order.push("watcher"))

    channel.announce()

    expect(order).toEqual(["clear", "clear", "watcher"])
    stop()
    channel.announce()
    expect(order).toEqual(["clear", "clear", "watcher", "clear"])
  })

  it("reacts to other tabs through storage events for its own key only", () => {
    const watcher = vi.fn()
    const stop = createSessionChannel("test-session").watch(watcher)

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }))
    window.dispatchEvent(new StorageEvent("storage", { key: "test-session" }))

    expect(watcher).toHaveBeenCalledOnce()
    stop()
  })

  it("still announces when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("blocked")
      },
    })
    const watcher = vi.fn()
    const channel = createSessionChannel("test-session")
    const stop = channel.watch(watcher)

    expect(() => channel.announce()).not.toThrow()
    expect(watcher).toHaveBeenCalledOnce()
    stop()
  })
})
