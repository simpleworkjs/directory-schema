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

## Declaring a new secret field

Add it to `METADATA_KEYS` in `lib/schema.js` with `secret: true`. The projection strips it in both the admin and non-admin paths. Unknown keys matching `/secret|password|privatekey/i` are also stripped as defense in depth.

## License

MIT © William Mantly