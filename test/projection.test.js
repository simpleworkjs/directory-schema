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