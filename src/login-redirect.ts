export const DEFAULT_LOGIN_PATH = "/api/auth/login"
export const DEFAULT_RETURN_PARAM = "return_to"

export interface SafeReturnPathOptions {
  fallback?: string
  // Local paths that must never be returned to, e.g. the auth routes themselves.
  blockedPrefixes?: readonly string[]
}

// Only same-origin absolute paths; "//host" and "/\host" would leave the site.
export function getSafeReturnPath(value: string | null | undefined, options: SafeReturnPathOptions = {}): string {
  const fallback = options.fallback ?? "/"
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (options.blockedPrefixes?.some((prefix) => value.startsWith(prefix))) return fallback
  return value
}

export interface LoginRedirectOptions extends SafeReturnPathOptions {
  // The app backend's login route, which starts the Identity sign-in.
  loginPath?: string
  // Defaults to the current page.
  returnTo?: string
  returnParam?: string
}

export function getLoginUrl(options: LoginRedirectOptions = {}): string {
  const loginUrl = new URL(options.loginPath ?? DEFAULT_LOGIN_PATH, window.location.origin)
  const current = `${window.location.pathname}${window.location.search}`
  loginUrl.searchParams.set(options.returnParam ?? DEFAULT_RETURN_PARAM, getSafeReturnPath(options.returnTo || current, options))
  return loginUrl.toString()
}

export function redirectToLogin(options: LoginRedirectOptions = {}): void {
  window.location.replace(getLoginUrl(options))
}
