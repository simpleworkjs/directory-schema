# Changelog

Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-07-30

Declares the metadata keys sso-manager-node's admin UI was already writing but
that `METADATA_KEYS` never listed. Because the non-admin projection keeps only
the *declared* public allowlist, every one of them was being silently dropped on
the way to any non-admin caller.

### Fixed
- **Undeclared metadata keys were stripped for non-admin callers.** The directory admin form writes `port`, `externalPort`, `isExternalReachable`, `os`, `gitRepo`, `isCurrentSite`, `vmid`, `macAddress`, `installPath` and `systemdService`; none were declared, so `projectResource(..., {fullMetadata: false})` dropped them all. Two visible consequences: the end-user portal rendered a permanently blank `OS:` field and could never show a service's port, and — since `isDirectoryAdmin()` is false for `isMachine` — a `ServiceToken` caller could not read `port` / `externalPort` / `isExternalReachable`, which is exactly the data the firewall port-forward consumer exists to render.

### Added
- Public (non-admin-visible) keys: `port`, `externalPort`, `isExternalReachable`, `os`, `gitRepo`, `isCurrentSite`. These are half the answer to "how do I reach this", and the firewall consumer reads them over a machine token.
- Admin-only keys: `vmid`, `macAddress`, `installPath`, `systemdService` — infra internals with no end-user value.
- Regression tests: the connection/display keys survive a non-admin projection, the operator-detail keys do not, and a `ServiceToken` caller reads the firewall fields while `client_secret_hash` still never leaves.

### Changed
- `subType` description now matches the values the UI actually suggests (`proxmox_node`, `web`) rather than `linux/windows`.

## [1.0.0] — 2026-07-25

Initial release. The shared sso↔client directory contract, extracted so sso-manager-node and jump-host stop duck-typing each other over HTTP.

### Added
- `KIND_ENUM` (`site | host | service | oauth`) + `isKind`.
- `METADATA_KEYS` — the metadata convention keys with `admin`/`secret` flags (connection, display, access-flag, and OAuth keys).
- `RESOURCE_FIELDS` / `RESOURCE_EDGE_FIELDS` / `RESOURCE_GROUP_FIELDS` — the canonical ORM field definitions.
- `envelope(x)` / `unwrapEnvelope(body)` — the `{ results }` envelope contract; `unwrapEnvelope` throws `DirectoryEnvelopeViolation` on a bare array or missing `results`.
- `projectResource(r, {fullMetadata})` / `projectResources(arr, opts)` — the security projection. Strips keys flagged `secret: true` (and unknown `/secret|password|privatekey/i` keys) in both paths; for non-admins keeps only the public allowlist (`PUBLIC_METADATA_KEYS`). Non-mutating.
- `isDirectoryAdmin(user)` — true for a human session whose `groups` include `app_sso_directory_admin` / `app_sso_admin`; machines are never admins.
- `createDirectoryClient({baseUrl, apiToken, fetch?})` — thin HTTP discovery client (`getResourcesByGroup`, `getResourceBySlug`, `getGraph`, `getMyAccess`, `getAccess`) that validates the envelope on every call and throws `DirectoryRequestFailed` on a non-ok response.
- `node --test` suite covering the schema, projection (incl. `client_secret_hash` stripping + `token_lifetime` kept), envelope, and client.