'use strict';

/**
 * The canonical directory schema: resource kinds, metadata convention keys,
 * and the ORM field definitions for Resource / ResourceEdge / ResourceGroup.
 *
 * sso-manager-node instantiates RESOURCE_FIELDS etc. as @simpleworkjs/orm
 * `Model.fields`; clients (jump-host) consume the kind + metadata keys via the
 * discovery client + projection so both sides stay on the same contract.
 *
 * Metadata keys carry flags the projection reads:
 *   - `admin: true`  -> only directory admins see it (non-admins get the public
 *                       allowlist, which excludes admin keys).
 *   - `secret: true` -> NEVER returned over the API, even to admins (stripped by
 *                       projectResource in both paths). `client_secret_hash` is
 *                       the canonical example. New secret fields MUST be
 *                       declared here with `secret: true`.
 */

const KIND_ENUM = ['site', 'host', 'service', 'oauth'];

function isKind(v){ return KIND_ENUM.includes(v); }

const METADATA_KEYS = {
	// --- connection (jump-host dials hosts via these) ---
	ip:           { type: 'string',  admin: false, description: 'IPv4/IPv6 address' },
	address:      { type: 'string',  admin: false, description: 'Host/address to reach' },
	sshPort:      { type: 'integer', admin: false, description: 'SSH port (default 22)' },
	fqdn:         { type: 'string',  admin: false, description: 'Fully-qualified domain name' },
	dnsNames:     { type: 'array',   admin: false, description: 'Alternate DNS names' },
	portMappings: { type: 'object',  admin: false, description: 'service -> port map' },
	// A service is reached at <address-or-host-ip>:<port>. Both of these must
	// stay public: they are half of the answer to "how do I reach this", and the
	// firewall-rule consumer reads them over a ServiceToken, which never counts
	// as a directory admin (isDirectoryAdmin() is false for isMachine).
	port:         { type: 'integer', admin: false, description: 'Internal listening port' },
	externalPort: { type: 'integer', admin: false, description: 'Public-facing port; defaults to `port`' },
	// --- display ---
	icon:         { type: 'string',  admin: false },
	tagline:      { type: 'string',  admin: false },
	subType:      { type: 'string',  admin: false, description: 'e.g. proxmox_node, web' },
	description:  { type: 'string',  admin: false },
	os:           { type: 'string',  admin: false, description: 'OS / kernel of a host' },
	gitRepo:      { type: 'string',  admin: false, description: 'Source repository URL' },
	// --- access flags ---
	isPublic:     { type: 'boolean', admin: false, description: 'Visible to any authenticated caller' },
	isProduction: { type: 'boolean', admin: false, description: 'Bubbled up from children by getGraph' },
	requestable:  { type: 'boolean', admin: false, description: 'Self-service requestable' },
	// Also read by the firewall consumer over a ServiceToken -- keep public.
	isExternalReachable: { type: 'boolean', admin: false, description: 'Reachable from outside the LAN' },
	isCurrentSite:       { type: 'boolean', admin: false, description: 'Marks the site this deployment lives in' },
	// --- operator detail (admin-only: infra internals, no user-facing value) ---
	vmid:           { type: 'integer', admin: true, description: 'Proxmox VM/CT id' },
	macAddress:     { type: 'string',  admin: true },
	installPath:    { type: 'string',  admin: true, description: 'On-host install directory' },
	systemdService: { type: 'string',  admin: true, description: 'systemd unit name' },
	// --- oauth (admin-only; client_secret_hash is a secret) ---
	client_secret_hash: { type: 'string', admin: true, secret: true, description: 'bcrypt hash; NEVER returned over the API' },
	redirect_uris:      { type: 'array',  admin: true },
	scopes:             { type: 'array',  admin: true },
	allowed_groups:     { type: 'array',  admin: true },
	token_lifetime:     { type: 'object', admin: true, description: 'access/refresh token lifetimes (config, not a secret)' },
	is_valid:           { type: 'boolean', admin: true },
};

// ORM field definitions — the single source of truth for the resource schema.
// Identical to the inline defs they replace in sso-manager-node/models/resource.js.
const RESOURCE_FIELDS = {
	id:            { type: 'uuid', primaryKey: true },
	kind:          { type: 'string', isRequired: true },
	name:          { type: 'string', isRequired: true },
	slug:          { type: 'string', isRequired: true, unique: true },
	owner:         { type: 'string' },
	description:   { type: 'text' },
	metadata:      { type: 'json', default: {} },
	edgesAsParent: { type: 'hasMany', model: 'ResourceEdge', remoteKey: 'parentId' },
	edgesAsChild:  { type: 'hasMany', model: 'ResourceEdge', remoteKey: 'childId' },
	groups:        { type: 'hasMany', model: 'ResourceGroup', remoteKey: 'resourceId' },
};

const RESOURCE_EDGE_FIELDS = {
	id:       { type: 'uuid', primaryKey: true },
	parent:   { type: 'hasOne', model: 'Resource' }, // creates parentId
	child:    { type: 'hasOne', model: 'Resource' }, // creates childId
	relation: { type: 'string', isRequired: true },
};

const RESOURCE_GROUP_FIELDS = {
	id:          { type: 'uuid', primaryKey: true },
	resource:    { type: 'hasOne', model: 'Resource' }, // creates resourceId
	groupCn:     { type: 'string', isRequired: true },
	accessLevel: { type: 'string', isRequired: true },
};

module.exports = {
	KIND_ENUM, isKind, METADATA_KEYS,
	RESOURCE_FIELDS, RESOURCE_EDGE_FIELDS, RESOURCE_GROUP_FIELDS,
};