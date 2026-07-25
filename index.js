'use strict';

/**
 * @simpleworkjs/directory-schema
 *
 * The shared contract between the SSO directory (sso-manager-node) and its
 * clients (jump-host, and anything else querying who-can-reach-what):
 *
 *   - the resource `kind` enum + metadata convention keys (the schema),
 *   - the `{ results: [...] }` response envelope,
 *   - `projectResource` / `isDirectoryAdmin` — the security projection that
 *     unconditionally strips secrets (e.g. an OAuth client's `client_secret_hash`)
 *     and, for non-admins, restricts metadata to a public allowlist,
 *   - `createDirectoryClient` — a thin HTTP discovery client that validates the
 *     envelope on every call (so a silent shape change surfaces as a thrown error
 *     instead of an empty list).
 *
 * Pure JS, no runtime dependencies (the client uses the global `fetch`, which is
 * injectable for tests).
 */

const { KIND_ENUM, isKind, METADATA_KEYS, RESOURCE_FIELDS, RESOURCE_EDGE_FIELDS, RESOURCE_GROUP_FIELDS } = require('./lib/schema');
const { DIRECTORY_ADMIN_GROUPS, PUBLIC_METADATA_KEYS, isSecretKey, isDirectoryAdmin, projectResource, projectResources } = require('./lib/projection');
const { envelope, unwrapEnvelope } = require('./lib/envelope');
const { createDirectoryClient } = require('./lib/client');

module.exports = {
	// schema
	KIND_ENUM, isKind, METADATA_KEYS,
	RESOURCE_FIELDS, RESOURCE_EDGE_FIELDS, RESOURCE_GROUP_FIELDS,
	// projection / authz
	DIRECTORY_ADMIN_GROUPS, PUBLIC_METADATA_KEYS, isSecretKey,
	isDirectoryAdmin, projectResource, projectResources,
	// envelope
	envelope, unwrapEnvelope,
	// client
	createDirectoryClient,
};