# Changelog

Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — 2026-09-16

The catalog at `/` becomes a curated launchpad instead of a render of the whole
directory, and this is the half of it that lives in the contract.

### Changed
- **`status` is now public** (was admin-only). A status indicator on the
  user-facing catalog was impossible while the only callers who never received
  the field were the people the catalog exists for. The value is a four-state
  enum (`ok`/`warning`/`critical`/`unknown`) about a resource the caller can
  already reach, so it discloses nothing they could not learn by trying it.

### Added
- **`catalog`** (public) — an admin featured this resource on the launchpad.
  Deliberately *not* `managed`: `managed` is an inventory statement and nearly
  everything in a populated directory carries it (76 of 79 rows on the instance
  this was designed against), while `catalog` is a presentation statement
  covering a handful. It must be public, because the launchpad renders for
  ordinary users — a non-admin who cannot see the field they are filtered on
  gets either everything or nothing.
- **HTTP endpoint shape** (public): `isHTTPS`, `externalIsHTTPS`, `healthPath`.
  A catalog entry is an `http` service; internal (`isHTTPS`/`address`/`port`)
  and external (`externalIsHTTPS`/`fqdn`/`externalPort`) are separate because a
  service is commonly reachable both ways on different schemes and ports. Flat
  rather than nested objects: the projection copies key by key and cannot walk
  into an object, so a nested shape would pass through or drop wholesale.
- **Derived status fields declared admin-only**: `status_message`,
  `bubbled_status`, `bubbled_status_from`, `bubbled_environment`,
  `bubbled_tags`, `environment`, `tags`. No behaviour change — they were
  undeclared and therefore already dropped for non-admins. The split from
  `status` is deliberate: `status_message` is prose written for an operator and
  can name infrastructure the caller cannot reach, and `bubbled_*` summarises a
  whole subtree, which would leak the state of descendants the projection is
  hiding. A consumer wanting context walks to the nearest host and reads its
  `status` instead.
- Regression tests: every field a catalog card renders survives a non-admin
  projection; `status` goes out while its derived fields do not; and `catalog`
  and `managed` are held independent so they cannot quietly collapse into each
  other.

## [1.2.0] — 2026-08-25

The same failure as v1.1.0, one layer over: keys that consumers read, that the
projection was silently dropping because nobody had declared them.

### Fixed
- **jump-host's catalog filter could not see what it keys on.** `isCatalogHost` excludes resources the SSO merely *discovered* and nobody promoted, by reading `managed` and `discovery_sources`. Neither was declared in `METADATA_KEYS`, so `projectResource(..., {fullMetadata: false})` dropped both — and jump-host is a machine caller, which `isDirectoryAdmin()` never treats as an admin. Every resource therefore arrived with neither field, `autoDiscovered` computed `false`, and the filter returned `true` for everything it was asked about.

  Two consequences in theta-suite: `allHosts()` — the admin host view — listed unpromoted discovery output (Proxmox guests, UniFi clients) as though it were catalog content, which is the exact bug jump-host v3.3.0 believed it had fixed. `accessibleHosts()` escaped only because the SSO applies the same rule server-side before answering, so the client-side filter had nothing left to catch.

### Added
- Public keys: `managed`, `discovery_sources`. Neither is sensitive — `managed` says an operator put the resource in the catalog, `discovery_sources` names the plugin that found it — and both are only ever returned for resources the caller can already reach.
- Admin-only keys, so `METADATA_KEYS` is a complete map of the contract rather than a partial one: `serviceName`, `dockerContainer`, `kernel`, `cpu`, `ram_total_gb`, `disk_total_gb`, `public_ip`, `interfaces`, `node`, `status`, `agentId`, `hostId`, `sourceId`, `last_seen`. **No behaviour change** — the admin path already passed these through and the non-admin path already dropped them. They are declared because a key nobody thought to declare is invisible to every non-admin caller, and the failure looks like a logic error at the consumer.
- `agentId`'s description records that it is a binding record and **not** proof the enrolment is still live: it survives revocation, so anything gating access on an agent must check the agent, not the field.
- Regression tests: the catalog keys survive a non-admin projection; jump-host's exact predicate, run over the projection a machine caller actually receives, now excludes unpromoted discovery output (the case that used to pass); the reconciler bindings stay admin-only; and a completeness test holding `METADATA_KEYS` to the keys the theta-suite reconcilers and discovery plugins write, so the next omission fails the suite instead of going quiet in production.

### Changed
- README: "Declaring a new secret field" is now "Declaring a new metadata key", with the flag table and the rule that **every** key must be declared, admin-only ones included.

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