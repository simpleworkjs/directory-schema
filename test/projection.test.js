'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { projectResource, projectResources, isDirectoryAdmin, isSecretKey, PUBLIC_METADATA_KEYS } = require('..');

const OAUTH = {
	id: 'c1', kind: 'oauth', name: 'Gitea', slug: 'gitea',
	metadata: {
		client_secret_hash: '$2b$10$xxxx',
		redirect_uris: ['https://app/cb'],
		scopes: ['openid'],
		allowed_groups: ['admins'],
		token_lifetime: { access_token: 3600 },
		is_valid: true,
	},
};

const HOST = {
	id: 'h1', kind: 'host', name: 'web01', slug: 'host_web01',
	metadata: { ip: '10.0.0.5', sshPort: 22, address: 'web01.internal', subType: 'linux', isProduction: true },
};

test('non-admin: only the public allowlist is kept (secrets stripped)', () => {
	const out = projectResource(OAUTH, { fullMetadata: false });
	assert.deepEqual(out.metadata, {});
	assert.equal(out.id, 'c1');
	assert.equal(out.kind, 'oauth');
});

test('non-admin: host connection keys survive', () => {
	const out = projectResource(HOST, { fullMetadata: false });
	assert.deepEqual(out.metadata, { ip: '10.0.0.5', sshPort: 22, address: 'web01.internal', subType: 'linux', isProduction: true });
});

test('admin: client_secret_hash is stripped, token_lifetime/redirect_uris kept', () => {
	const out = projectResource(OAUTH, { fullMetadata: true });
	assert.equal(out.metadata.client_secret_hash, undefined, 'secret must never leak, even to admins');
	assert.deepEqual(out.metadata.redirect_uris, ['https://app/cb']);
	assert.deepEqual(out.metadata.token_lifetime, { access_token: 3600 });
	assert.equal(out.metadata.scopes[0], 'openid');
});

test('admin: host keeps all non-secret metadata', () => {
	const out = projectResource(HOST, { fullMetadata: true });
	assert.equal(out.metadata.ip, '10.0.0.5');
	assert.equal(out.metadata.sshPort, 22);
});

test('isSecretKey flags known + unknown secret-ish keys', () => {
	assert.equal(isSecretKey('client_secret_hash'), true);
	assert.equal(isSecretKey('db_password'), true);
	assert.equal(isSecretKey('privatekey'), true);
	assert.equal(isSecretKey('token_lifetime'), false, 'config, not a secret');
	assert.equal(isSecretKey('ip'), false);
});

test('projection is non-mutating', () => {
	const before = JSON.parse(JSON.stringify(OAUTH));
	projectResource(OAUTH, { fullMetadata: true });
	assert.deepEqual(OAUTH, before);
});

test('projection tolerates missing metadata + null', () => {
	assert.deepEqual(projectResource({ id: 'x', kind: 'host' }).metadata, {});
	assert.equal(projectResource(null), null);
});

test('projectResources maps + tolerates non-array', () => {
	const out = projectResources([OAUTH, HOST], { fullMetadata: false });
	assert.equal(out.length, 2);
	assert.equal(out[0].metadata.client_secret_hash, undefined);
	assert.deepEqual(projectResources(null), []);
});

test('isDirectoryAdmin: admin group, machine, non-admin', () => {
	assert.ok(isDirectoryAdmin({ groups: ['app_sso_directory_admin'] }));
	assert.ok(isDirectoryAdmin({ groups: ['other', 'app_sso_admin'] }));
	assert.ok(!isDirectoryAdmin({ groups: ['host_web01_access'] }));
	assert.ok(!isDirectoryAdmin({ isMachine: true, groups: ['app_sso_admin'] }), 'machines are never admins');
	assert.ok(!isDirectoryAdmin(null));
});

test('PUBLIC_METADATA_KEYS excludes admin + secret keys', () => {
	assert.ok(!PUBLIC_METADATA_KEYS.includes('client_secret_hash'));
	assert.ok(!PUBLIC_METADATA_KEYS.includes('redirect_uris'));
	assert.ok(!PUBLIC_METADATA_KEYS.includes('token_lifetime'));
	assert.ok(PUBLIC_METADATA_KEYS.includes('ip'));
	assert.ok(PUBLIC_METADATA_KEYS.includes('sshPort'));
});
// Regression: the admin UI writes these keys on every save, but they were never
// declared in METADATA_KEYS -- so the non-admin allowlist silently dropped all
// of them. That blanked OS/port in the end-user portal and, because service
// tokens are never directory admins, left the firewall consumer unable to read
// the port mapping it exists to render.
test('connection + display keys survive the non-admin projection', () => {
	const r = { id: 'h1', kind: 'service', metadata: {
		port: 8080, externalPort: 443, isExternalReachable: true,
		os: 'Debian 12', gitRepo: 'https://example.invalid/r', isCurrentSite: true,
	}};
	const out = projectResource(r, { fullMetadata: false }).metadata;
	assert.deepEqual(out, r.metadata, 'none of these may be stripped from a normal caller');
});

test('operator-detail keys are admin-only', () => {
	const r = { id: 'h1', kind: 'host', metadata: {
		ip: '10.0.0.5', vmid: 101, macAddress: 'aa:bb:cc:dd:ee:ff',
		installPath: '/opt/app', systemdService: 'app.service',
	}};
	const pub = projectResource(r, { fullMetadata: false }).metadata;
	assert.deepEqual(pub, { ip: '10.0.0.5' });

	const adm = projectResource(r, { fullMetadata: true }).metadata;
	assert.deepEqual(adm, r.metadata, 'admins still see operator detail');
});

test('a service token reads what the firewall consumer needs', () => {
	// isMachine => never an admin => non-admin projection. This is the exact
	// call path routes/discovery.js takes for a ServiceToken caller.
	const user = { isMachine: true, groups: [] };
	const r = { id: 's1', kind: 'service', metadata: {
		ip: '10.0.0.5', port: 8080, externalPort: 443, isExternalReachable: true,
		client_secret_hash: '$2b$nope',
	}};
	const out = projectResource(r, { fullMetadata: isDirectoryAdmin(user) }).metadata;
	assert.equal(out.port, 8080);
	assert.equal(out.externalPort, 443);
	assert.equal(out.isExternalReachable, true);
	assert.equal(out.client_secret_hash, undefined, 'secret never leaves, machine or not');
});
