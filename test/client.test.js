'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createDirectoryClient } = require('..');

function stubFetch(map){
	return async (url, opts) => {
		const stub = map[url] || map['*'];
		if (!stub) return { ok: false, status: 404, json: async () => ({}) };
		if (stub.throw) throw stub.throw;
		return { ok: stub.ok !== false, status: stub.status || 200, json: async () => stub.body };
	};
}

test('getResourcesByGroup builds the query URL and unwraps the envelope', async () => {
	let seen;
	const fetchImpl = async (url) => {
		seen = url;
		return { ok: true, status: 200, json: async () => ({ results: [{ id: '1', kind: 'host' }] }) };
	};
	const c = createDirectoryClient({ baseUrl: 'https://sso.example.com', apiToken: 'tok', fetch: fetchImpl });
	const out = await c.getResourcesByGroup('host_web01_access');
	assert.equal(seen, 'https://sso.example.com/api/discovery/resources?group=host_web01_access');
	assert.deepEqual(out, [{ id: '1', kind: 'host' }]);
});

test('getResourcesByGroup forwards kind + parent filters', async () => {
	let seen;
	const fetchImpl = async (url) => { seen = url; return { ok: true, json: async () => ({ results: [] }) }; };
	const c = createDirectoryClient({ baseUrl: 'https://sso', apiToken: 't', fetch: fetchImpl });
	await c.getResourcesByGroup('g', { kind: 'host', parent: 'site_prod' });
	const u = new URL(seen);
	assert.equal(u.searchParams.get('group'), 'g');
	assert.equal(u.searchParams.get('kind'), 'host');
	assert.equal(u.searchParams.get('parent'), 'site_prod');
});

test('a bare-array response (the drift shape) throws an envelope violation', async () => {
	const fetchImpl = async () => ({ ok: true, json: async () => [{ id: '1' }] });
	const c = createDirectoryClient({ baseUrl: 'https://sso', apiToken: 't', fetch: fetchImpl });
	await assert.rejects(() => c.getResourcesByGroup('g'), /DirectoryEnvelopeViolation/);
});

test('a non-ok response throws DirectoryRequestFailed with status', async () => {
	const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
	const c = createDirectoryClient({ baseUrl: 'https://sso', apiToken: 't', fetch: fetchImpl });
	await assert.rejects(() => c.getGraph(), (e) => e.name === 'DirectoryRequestFailed' && e.status === 500);
});

test('getAccess builds /access/:uid and /access/:uid/:slug', async () => {
	const seen = [];
	const fetchImpl = async (url) => { seen.push(url); return { ok: true, json: async () => ({ results: [] }) }; };
	const c = createDirectoryClient({ baseUrl: 'https://sso', apiToken: 't', fetch: fetchImpl });
	await c.getAccess('alice');
	await c.getAccess('alice', 'host_web01');
	assert.equal(seen[0], 'https://sso/api/discovery/access/alice');
	assert.equal(seen[1], 'https://sso/api/discovery/access/alice/host_web01');
});

test('authorization header carries the api token', async () => {
	let hdr;
	const fetchImpl = async (url, opts) => { hdr = opts.headers.Authorization; return { ok: true, json: async () => ({ results: [] }) }; };
	const c = createDirectoryClient({ baseUrl: 'https://sso', apiToken: 'secret-tok', fetch: fetchImpl });
	await c.getMyAccess();
	assert.equal(hdr, 'Bearer secret-tok');
});