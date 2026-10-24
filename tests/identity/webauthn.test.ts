import { describe, expect, it } from "vitest"

import { credentialToJSON, parseCreationOptions, parseRequestOptions } from "../../src/identity"

const bytes = (buffer: BufferSource | undefined) => Array.from(new Uint8Array(buffer as ArrayBuffer))

describe("parseCreationOptions", () => {
  it("decodes base64url values and normalizes snake_case fields", () => {
    const options = parseCreationOptions({
      challenge: "AQID",
      rp: { name: "Mennara" },
      user: { id: "BAU", user_name: "jordan", display_name: "Jordan Davis" },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      exclude_credentials: [{ id: "Bg", type: "public-key", transports: "usb, nfc, bogus" }],
      authenticator_selection: { residentKey: "required" },
    })

    expect(bytes(options.challenge)).toEqual([1, 2, 3])
    expect(bytes(options.user.id)).toEqual([4, 5])
    expect(options.user).toMatchObject({ name: "jordan", displayName: "Jordan Davis" })
    expect(options.pubKeyCredParams).toEqual([{ type: "public-key", alg: -7 }])
    expect(options.excludeCredentials?.[0]?.transports).toEqual(["usb", "nfc"])
    expect(options.authenticatorSelection).toEqual({ residentKey: "required" })
    expect(options).not.toHaveProperty("pub_key_cred_params")
    expect(options).not.toHaveProperty("exclude_credentials")
  })
})

describe("parseRequestOptions", () => {
  it("honours snake_case relying party and verification fields", () => {
    const options = parseRequestOptions({
      challenge: "AQID",
      allow_credentials: [{ id: "Bg", type: "public-key" }],
      rp_id: "mennara.example",
      user_verification: "required",
    })

    expect(options.rpId).toBe("mennara.example")
    expect(options.userVerification).toBe("required")
    expect(bytes(options.allowCredentials?.[0]?.id)).toEqual([6])
    expect(options.allowCredentials?.[0]).not.toHaveProperty("transports")
    expect(options).not.toHaveProperty("rp_id")
  })
})

describe("credentialToJSON", () => {
  it("treats a missing credential as a cancelled operation", () => {
    expect(() => credentialToJSON(null)).toThrow("Passkey operation was cancelled")
  })
})
