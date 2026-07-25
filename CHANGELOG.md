# Changelog

Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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