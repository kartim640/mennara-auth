// Converts Identity's passkey JSON (camelCase or snake_case) to WebAuthn browser objects and back.

export type WebAuthnCredentialDescriptorJSON = Omit<PublicKeyCredentialDescriptor, "id" | "transports"> & {
  id: string
  transports?: AuthenticatorTransport[] | string
}

export interface WebAuthnCreationOptionsJSON
  extends Omit<
    PublicKeyCredentialCreationOptions,
    "challenge" | "user" | "excludeCredentials" | "pubKeyCredParams" | "authenticatorSelection"
  > {
  challenge: string
  user: Omit<PublicKeyCredentialUserEntity, "id" | "name" | "displayName"> & {
    id: string
    name?: string
    displayName?: string
    user_name?: string
    display_name?: string
  }
  pubKeyCredParams?: PublicKeyCredentialParameters[]
  pub_key_cred_params?: PublicKeyCredentialParameters[]
  excludeCredentials?: WebAuthnCredentialDescriptorJSON[]
  exclude_credentials?: WebAuthnCredentialDescriptorJSON[]
  authenticatorSelection?: AuthenticatorSelectionCriteria
  authenticator_selection?: AuthenticatorSelectionCriteria
}

export interface WebAuthnRequestOptionsJSON
  extends Omit<PublicKeyCredentialRequestOptions, "challenge" | "allowCredentials" | "rpId" | "userVerification"> {
  challenge: string
  allowCredentials?: WebAuthnCredentialDescriptorJSON[]
  allow_credentials?: WebAuthnCredentialDescriptorJSON[]
  rpId?: string
  rp_id?: string
  userVerification?: UserVerificationRequirement
  user_verification?: UserVerificationRequirement
}
const validAuthenticatorTransports = new Set<AuthenticatorTransport>([
  "ble",
  "hybrid",
  "internal",
  "nfc",
  "usb",
])

function assertBrowserBase64Support(): void {
  if (
    typeof window === "undefined" ||
    typeof window.atob !== "function" ||
    typeof window.btoa !== "function"
  ) {
    throw new Error("Passkey helpers are only available in the browser.")
  }
}

function isAuthenticatorTransport(value: string): value is AuthenticatorTransport {
  return validAuthenticatorTransports.has(value as AuthenticatorTransport)
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  assertBrowserBase64Support()

  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")

  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function bufferToBase64Url(value: ArrayBuffer): string {
  assertBrowserBase64Support()

  const bytes = new Uint8Array(value)
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function normalizeTransports(
  value: unknown,
): AuthenticatorTransport[] | undefined {
  if (!value) return undefined

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : []

  const transports = rawValues
    .map((item) => String(item).trim())
    .filter(isAuthenticatorTransport)

  return transports.length > 0 ? transports : undefined
}

function parseCredentialDescriptor(
  credential: WebAuthnCredentialDescriptorJSON,
): PublicKeyCredentialDescriptor {
  const { id, transports, ...rest } = credential
  const normalizedTransports = normalizeTransports(transports)

  return {
    ...rest,
    id: base64UrlToBuffer(id),
    ...(normalizedTransports ? { transports: normalizedTransports } : {}),
  }
}

/**
 * Converts passkey creation options from API JSON to browser format.
 */
export function parseCreationOptions(
  options: WebAuthnCreationOptionsJSON,
): PublicKeyCredentialCreationOptions {
  const {
    pub_key_cred_params,
    exclude_credentials,
    authenticator_selection,
    pubKeyCredParams,
    excludeCredentials,
    authenticatorSelection,
    challenge,
    user,
    ...rest
  } = options
  const excluded = excludeCredentials ?? exclude_credentials
  const selection = authenticatorSelection ?? authenticator_selection
  const name = user.name ?? user.user_name ?? ""

  return {
    ...rest,
    challenge: base64UrlToBuffer(challenge),
    user: {
      ...user,
      id: base64UrlToBuffer(user.id),
      name,
      displayName: user.displayName ?? user.display_name ?? name,
    },
    pubKeyCredParams: pubKeyCredParams ?? pub_key_cred_params ?? [],
    ...(excluded ? { excludeCredentials: excluded.map(parseCredentialDescriptor) } : {}),
    ...(selection ? { authenticatorSelection: selection } : {}),
  }
}

/**
 * Converts passkey request options from API JSON to browser format.
 */
export function parseRequestOptions(
  options: WebAuthnRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
  const {
    allow_credentials,
    rp_id,
    user_verification,
    allowCredentials,
    rpId,
    userVerification,
    challenge,
    ...rest
  } = options
  const allowed = allowCredentials ?? allow_credentials
  const relyingParty = rpId ?? rp_id
  const verification = userVerification ?? user_verification

  return {
    ...rest,
    challenge: base64UrlToBuffer(challenge),
    ...(allowed ? { allowCredentials: allowed.map(parseCredentialDescriptor) } : {}),
    ...(relyingParty ? { rpId: relyingParty } : {}),
    ...(verification ? { userVerification: verification } : {}),
  }
}

/**
 * Converts a browser passkey credential into API-safe JSON.
 */
export function credentialToJSON(
  credential: Credential | null,
): Record<string, unknown> {
  if (
    typeof PublicKeyCredential === "undefined" ||
    !(credential instanceof PublicKeyCredential)
  ) {
    throw new Error("Passkey operation was cancelled")
  }

  const response = credential.response

  const json: Record<string, unknown> = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {},
  }

  if (
    typeof AuthenticatorAttestationResponse !== "undefined" &&
    response instanceof AuthenticatorAttestationResponse
  ) {
    json.response = {
      attestationObject: bufferToBase64Url(response.attestationObject),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      transports:
        typeof response.getTransports === "function"
          ? response.getTransports()
          : undefined,
    }

    return json
  }

  if (
    typeof AuthenticatorAssertionResponse !== "undefined" &&
    response instanceof AuthenticatorAssertionResponse
  ) {
    json.response = {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64Url(response.userHandle)
        : null,
    }

    return json
  }

  throw new Error("Unsupported passkey response")
}
