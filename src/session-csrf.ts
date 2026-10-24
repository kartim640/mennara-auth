export const DEFAULT_SESSION_CHANGED_MESSAGE = "The session changed. Reload to continue."

export interface SessionCsrfProof {
  token: string
  // The account the token was issued for.
  userId: string
}

export interface SessionCsrfOptions {
  // Asks the app's backend for a CSRF token bound to the current session.
  fetchProof: () => Promise<SessionCsrfProof>
  sessionChangedMessage?: string
}

export interface SessionCsrf {
  // Cached after the first call; concurrent first calls share one request.
  getToken(): Promise<string>
  // Pins the verified session's account; a token for another account is refused.
  bindIdentity(userId: string): void
  // Increases on every clear, so callers can drop responses from an older session.
  generation(): number
  // Clears only if the rejected token is still the cached one.
  invalidate(rejectedToken?: string): void
  clear(): void
}

/**
 * Keeps one session-bound CSRF token per page and refuses to mix sessions:
 * a token fetched while the session was cleared, or for another account than
 * the verified one, is never used.
 */
export function createSessionCsrf(options: SessionCsrfOptions): SessionCsrf {
  const changedMessage = options.sessionChangedMessage ?? DEFAULT_SESSION_CHANGED_MESSAGE
  let cachedToken: string | undefined
  let cachedUserId: string | undefined
  let pending: Promise<string> | undefined
  let generation = 0
  let expectedUserId: string | undefined

  function clear(): void {
    generation += 1
    cachedToken = undefined
    cachedUserId = undefined
    pending = undefined
  }

  async function getToken(): Promise<string> {
    if (cachedToken) {
      if (expectedUserId && cachedUserId !== expectedUserId) throw new Error(changedMessage)
      return cachedToken
    }
    if (pending) return pending

    const requestGeneration = generation
    const request = (async () => {
      const proof = await options.fetchProof()
      if (
        !proof.token ||
        !proof.userId ||
        requestGeneration !== generation ||
        (expectedUserId && proof.userId !== expectedUserId)
      ) {
        throw new Error(changedMessage)
      }
      cachedToken = proof.token
      cachedUserId = proof.userId
      return proof.token
    })()

    pending = request
    try {
      return await request
    } finally {
      if (pending === request) pending = undefined
    }
  }

  return {
    getToken,
    bindIdentity(userId) {
      if (expectedUserId && expectedUserId !== userId) throw new Error(changedMessage)
      expectedUserId = userId
    },
    generation: () => generation,
    invalidate(rejectedToken) {
      if (rejectedToken && rejectedToken !== cachedToken) return
      clear()
    },
    clear,
  }
}
