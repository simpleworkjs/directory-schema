# @simpleworkjs/directory-schema

The shared contract between the SSO directory (**sso-manager-node**) and its clients (**jump-host**, and anything else querying who-can-reach-what). Pure JS, no runtime dependencies.

It provides:

- **The schema** — the resource `kind` enum (`site | host | service | oauth`), the metadata convention keys (with `admin`/`secret` flags), and the ORM field definitions for `Resource` / `ResourceEdge` / `ResourceGroup`.
- **The `{ results }` envelope** — `envelope(x)` / `unwrapEnvelope(body)`. The discovery API returns `{ results: [...] }` for every list/detail endpoint; the client validates it on every call.
- **The security projection** — `projectResource(r, {fullMetadata})` / `projectResources(arr, opts)` / `isDirectoryAdmin(user)`. Unconditionally strips secrets (e.g. an OAuth client's `client_secret_hash`) and, for non-admins, restricts `metadata` to a public allowlist.
- **The discovery client** — `createDirectoryClient({baseUrl, apiToken, fetch?})` with `getResourcesByGroup`, `getResourceBySlug`, `getGraph`, `getMyAccess`, `getAccess`.

## Why

Two real problems this exists to fix:

1. **Security** — `Resource.getGraph()` / `Resource.list()` serialize `metadata` wholesale, so `/api/discovery/*` returned the OAuth `client_secret_hash` to any authenticated caller. `projectResource` strips it (and any key flagged `secret: true`, plus unknown secret-ish keys) in every response path.
2. **Contract drift** — the discovery autoRouter returned a *bare array*, but jump-host did `data.results || []`, which silently collapsed to `[]`: no user could bridge. The envelope + the validating client turn that drift into a loud error.

## Install

```sh
npm install @simpleworkjs/directory-schema
```

## Usage — server side (sso-manager-node)

```js
const { projectResources, projectResource, isDirectoryAdmin } = require('@simpleworkjs/directory-schema');

// GET /api/discovery/resources
const full = isDirectoryAdmin(req.user);          // admin? -> keep all non-secret metadata
const resources = await Resource.search(req.query);
res.json({ results: projectResources(resources, { fullMetadata: full }) });
```

## Usage — client side (jump-host)

```js
const { createDirectoryClient } = require('@simpleworkjs/directory-schema');
const conf = require('@simpleworkjs/conf');

const directory = createDirectoryClient({
  baseUrl: conf.sso.url,
  apiToken: conf.sso.apiToken,
});

// Resources granted to a group (validates the { results } envelope)
const hosts = await directory.getResourcesByGroup('host_web01_access', { kind: 'host' });
```

## Declaring a new metadata key

**Every metadata key must be declared in `METADATA_KEYS` (`lib/schema.js`), including admin-only ones.**

An undeclared key is not "unspecified" — it is *invisible to every non-admin caller*, because the non-admin path keeps only the declared public allowlist. And `isDirectoryAdmin()` is false for `isMachine`, so that includes every service token and every machine consumer.

This has now bitten twice (v1.1.0, v1.2.0), and both times the symptom looked like a logic error at the consumer rather than a schema omission: a blank field in the portal, a firewall rule with no port, a filter that silently matched everything. `test/projection.test.js` holds the list of keys the theta-suite reconcilers write, so a new one fails the suite rather than going quiet in production.

| flag | who sees it | when to use it |
| :--- | :--- | :--- |
| *(none)* | everyone, including machines | the caller needs it to reach, render, or reason about the resource |
| `admin: true` | directory admins only | infra internals with no consumer outside the admin UI |
| `secret: true` | **nobody** — stripped in both paths | credentials and hashes. Unknown keys matching `/secret\|password\|privatekey/i` are also stripped as defense in depth |

`admin: true` changes no behaviour on its own — the admin path already passes through anything not secret-named, and the non-admin path already dropped anything undeclared. Declare it anyway: the point is that `METADATA_KEYS` is a complete map of the contract, so the next person can see what exists and decide, rather than discovering a key by its absence.

## License

MIT © William Mantly