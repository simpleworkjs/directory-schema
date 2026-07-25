'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { KIND_ENUM, isKind, METADATA_KEYS, RESOURCE_FIELDS, RESOURCE_EDGE_FIELDS, RESOURCE_GROUP_FIELDS } = require('..');

test('KIND_ENUM is the four directory kinds', () => {
	assert.deepEqual(KIND_ENUM, ['site', 'host', 'service', 'oauth']);
});

test('isKind recognizes members and rejects others', () => {
	for (const k of KIND_ENUM) assert.ok(isKind(k), k);
	assert.ok(!isKind('widget'));
	assert.ok(!isKind(undefined));
});

test('client_secret_hash is flagged secret in METADATA_KEYS', () => {
	assert.equal(METADATA_KEYS.client_secret_hash.secret, true);
	assert.equal(METADATA_KEYS.client_secret_hash.admin, true);
});

test('token_lifetime is admin but NOT secret (config, not a credential)', () => {
	assert.equal(METADATA_KEYS.token_lifetime.admin, true);
	assert.equal(METADATA_KEYS.token_lifetime.secret, undefined);
});

test('jump-host connection keys are public (non-admin)', () => {
	for (const k of ['ip', 'address', 'sshPort', 'fqdn', 'dnsNames', 'portMappings']) {
		assert.ok(!METADATA_KEYS[k].admin, `${k} should be public`);
	}
});

test('RESOURCE_FIELDS has the expected primary key + relations', () => {
	assert.equal(RESOURCE_FIELDS.id.primaryKey, true);
	assert.equal(RESOURCE_FIELDS.id.type, 'uuid');
	assert.equal(RESOURCE_FIELDS.edgesAsParent.model, 'ResourceEdge');
	assert.equal(RESOURCE_FIELDS.groups.model, 'ResourceGroup');
	assert.equal(RESOURCE_FIELDS.metadata.type, 'json');
});

test('edge + group field defs reference Resource', () => {
	assert.equal(RESOURCE_EDGE_FIELDS.parent.model, 'Resource');
	assert.equal(RESOURCE_EDGE_FIELDS.child.model, 'Resource');
	assert.equal(RESOURCE_GROUP_FIELDS.resource.model, 'Resource');
});