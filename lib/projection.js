'use strict';

const { METADATA_KEYS } = require('./schema');

/**
 * The security projection: shape a resource for an API response so secrets
 * never leak, and non-admins only see the public metadata allowlist.
 *
 * `client_secret_hash` (the bcrypt hash stored on `kind:'oauth'` resources) is
 * the motivating case — `Resource.getGraph()`/`Resource.list()` serialize
 * `metadata` wholesale, so without this projection any authenticated caller
 * could read it.
 */

// Directory-admin group CNs, matched against `user.groups`.
const DIRECTORY_ADMIN_GROUPS = ['app_sso_directory_admin', 'app_sso_admin'];

// Metadata keys a non-admin caller may see: everything not flagged admin/secret.
const PUBLIC_METADATA_KEYS = Object.keys(METADATA_KEYS).filter(k => {
	const def = METADATA_KEYS[k];
	return !def.admin && !def.secret;
});

// Conservative denylist for *unknown* metadata keys (defense in depth). Known
// secret fields are declared in METADATA_KEYS with `secret: true` and stripped
// regardless of name. Note: deliberately does NOT match `token` —
// `token_lifetime` is config, not a secret.
const SECRET_KEY_RE = /secret|password|privatekey/i;

function isSecretKey(k){
	const def = METADATA_KEYS[k];
	if (def && def.secret) return true;
	return SECRET_KEY_RE.test(k);
}

// A directory admin is a (human) session user whose groups include one of the
// directory-admin CNs. Machine tokens are never directory admins.
function isDirectoryAdmin(user){
	if (!user || user.isMachine) return false;
	const groups = Array.isArray(user.groups) ? user.groups : [];
	return DIRECTORY_ADMIN_GROUPS.some(g => groups.includes(g));
}

/**
 * Project a single resource.
 * @param {object} r
 * @param {object} [opts]
 * @param {boolean} [opts.fullMetadata=false] - true for directory admins: keep
 *        all metadata except secret keys. false for everyone else: keep only the
 *        public allowlist.
 * @returns {object} a shallow copy with a cleaned `metadata`; non-metadata
 *          fields (id, kind, slug, name, resolvedAddress, parents/children,
 *          edges, …) pass through untouched.
 */
function projectResource(r, { fullMetadata = false } = {}){
	if (r == null) return r;
	const out = { ...r };
	const md = (r && typeof r.metadata === 'object' && r.metadata) ? r.metadata : {};
	const cleaned = {};
	if (fullMetadata) {
		for (const [k, v] of Object.entries(md)) {
			if (isSecretKey(k)) continue;
			cleaned[k] = v;
		}
	} else {
		for (const k of PUBLIC_METADATA_KEYS) {
			if (k in md) cleaned[k] = md[k];
		}
	}
	out.metadata = cleaned;
	return out;
}

function projectResources(arr, opts = {}){
	if (!Array.isArray(arr)) return [];
	return arr.map(r => projectResource(r, opts));
}

module.exports = {
	DIRECTORY_ADMIN_GROUPS, PUBLIC_METADATA_KEYS, SECRET_KEY_RE, isSecretKey,
	isDirectoryAdmin, projectResource, projectResources,
};