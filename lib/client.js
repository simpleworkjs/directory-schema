'use strict';

const { unwrapEnvelope } = require('./envelope');

/**
 * Thin discovery HTTP client. Consumed by jump-host (and any other directory
 * client) to query the SSO directory. Validates the `{ results }` envelope on
 * every call so a silent shape change surfaces as a thrown error instead of an
 * empty list.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl   - the SSO base URL (e.g. https://sso.internal)
 * @param {string} opts.apiToken  - the bearer API token (PAT) for the directory
 * @param {Function} [opts.fetch] - injectable fetch (defaults to global fetch)
 * @returns {{getResourcesByGroup, getResourceBySlug, getGraph, getMyAccess, getAccess}}
 */
function createDirectoryClient({ baseUrl, apiToken, fetch: fetchImpl = fetch } = {}){
	const base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
	const headers = { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' };

	async function request(path){
		const res = await fetchImpl(base + path, { headers });
		if (!res || !res.ok) {
			const err = new Error('DirectoryRequestFailed');
			err.name = 'DirectoryRequestFailed';
			err.status = res ? res.status : 0;
			err.path = path;
			throw err;
		}
		return unwrapEnvelope(await res.json());
	}

	function withQuery(path, params){
		const u = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== null && v !== '') u.set(k, v);
		}
		const qs = u.toString();
		return qs ? `${path}?${qs}` : path;
	}

	return {
		// GET /api/discovery/resources?group=&kind=&parent=
		getResourcesByGroup(group, { kind, parent } = {}){
			return request(withQuery('/api/discovery/resources', { group, kind, parent }));
		},
		// GET /api/discovery/resources/:slug
		getResourceBySlug(slug){
			return request(`/api/discovery/resources/${encodeURIComponent(slug)}`);
		},
		// GET /api/discovery/graph
		getGraph(){ return request('/api/discovery/graph'); },
		// GET /api/discovery/me
		getMyAccess(){ return request('/api/discovery/me'); },
		// GET /api/discovery/access/:uid[/:slug]
		getAccess(uid, slug){
			const p = `/api/discovery/access/${encodeURIComponent(uid)}`;
			return request(slug ? `${p}/${encodeURIComponent(slug)}` : p);
		},
	};
}

module.exports = { createDirectoryClient };