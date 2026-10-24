export interface SessionChannelOptions {
  // Runs before announcing and before each watcher is told, e.g. to clear cached session proof.
  onTransition?: () => void
}

export interface SessionChannel {
  // Tells this tab and every other tab of the app that the session changed (sign-out, switch).
  announce(): void
  // Calls back on any announcement; returns a function that stops watching.
  watch(onTransition: () => void): () => void
}

/**
 * Cross-tab "session changed" signal. Uses a window event for this tab, and both
 * localStorage and BroadcastChannel for other tabs, so it still works when one is unavailable.
 */
export function createSessionChannel(name: string, options: SessionChannelOptions = {}): SessionChannel {
  return {
    announce() {
      options.onTransition?.()
      if (typeof window === "undefined") return
      window.dispatchEvent(new Event(name))
      try {
        localStorage.setItem(name, `${Date.now()}-${Math.random()}`)
      } catch {
        // BroadcastChannel still informs tabs when storage is unavailable.
      }
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(name)
        channel.postMessage("changed")
        channel.close()
      }
    },
    watch(onTransition) {
      const transition = () => {
        options.onTransition?.()
        onTransition()
      }
      const storage = (event: StorageEvent) => {
        if (event.key === name) transition()
      }
      window.addEventListener(name, transition)
      window.addEventListener("storage", storage)
      const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(name) : undefined
      if (channel) channel.onmessage = transition
      return () => {
        window.removeEventListener(name, transition)
        window.removeEventListener("storage", storage)
        channel?.close()
      }
    },
  }
}
