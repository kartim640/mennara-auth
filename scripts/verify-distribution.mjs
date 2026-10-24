import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const packageDirectory = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(await readFile(resolve(packageDirectory, "package.json"), "utf8"))

for (const exportDefinition of Object.values(packageJson.exports)) {
  await access(resolve(packageDirectory, exportDefinition.import))
  await access(resolve(packageDirectory, exportDefinition.types))
}

const read = (file) => readFile(resolve(packageDirectory, "dist", file), "utf8")
const rootSource = await read("index.js")
const identitySource = await read("identity/index.js")

for (const source of [rootSource, identitySource]) {
  // Framework independent: no React, Next.js, or process.env reads in the shipped code.
  assert.doesNotMatch(source, /from\s+["'](?:react|next)/)
  assert.doesNotMatch(source, /process\.env/)
  assert.doesNotMatch(source, /^\s*["']use client["']/)
}

// The root entry must not pull in the Identity client: other apps never call Identity directly.
assert.doesNotMatch(rootSource, /from\s+["'][^"']*identity/)
assert.doesNotMatch(rootSource, /IdentityRequestError|createIdentityClient|x-mennara-selection-version/)

for (const name of ["createSessionCsrf", "createSessionChannel", "getSafeReturnPath", "getLoginUrl", "redirectToLogin"]) {
  assert.match(rootSource, new RegExp(`\\b${name}\\b`), `${name} must be exported from the root entry`)
}
for (const name of [
  "createIdentityClient",
  "createIdentityEndpoints",
  "IdentityRequestError",
  "isStepUpRequiredError",
  "isBrowserAccountsResponse",
  "parseCreationOptions",
  "parseRequestOptions",
  "credentialToJSON",
]) {
  assert.match(identitySource, new RegExp(`\\b${name}\\b`), `${name} must be exported from ./identity`)
}

console.log("Auth distribution exports and entry boundaries verified.")
