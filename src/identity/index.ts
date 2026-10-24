// Identity's own browser API. Only the Identity portals (Account, MyAccount) may use this entry;
// every other app signs in through its own backend.
export {
  isBrowserAccount,
  isBrowserAccountsResponse,
  type BrowserAccount,
  type BrowserAccountState,
  type BrowserAccountsResponse,
} from "./browser-accounts"
export {
  createIdentityClient,
  type IdentityClient,
  type IdentityClientOptions,
  type IdentityRequestOptions,
} from "./client"
export {
  createIdentityEndpoints,
  normalizeStepUpMethods,
  type IdentityEndpoints,
  type IdentityUser,
  type LoginMethod,
  type MessageResponse,
  type MfaSetup,
  type MfaStatus,
  type OAuthProvider,
  type PasskeyCredential,
  type SessionItem,
  type StepUpMethod,
  type StepUpMethods,
  type StepUpVerifyPayload,
} from "./endpoints"
export { IdentityRequestError, isStepUpRequiredError } from "./errors"
export {
  credentialToJSON,
  parseCreationOptions,
  parseRequestOptions,
  type WebAuthnCreationOptionsJSON,
  type WebAuthnCredentialDescriptorJSON,
  type WebAuthnRequestOptionsJSON,
} from "./webauthn"
