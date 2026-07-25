'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { envelope, unwrapEnvelope } = require('..');

test('envelope wraps a value under results', () => {
	assert.deepEqual(envelope([1, 2, 3]), { results: [1, 2, 3] });
	assert.deepEqual(envelope({ a: 1 }), { results: { a: 1 } });
});

test('unwrapEnvelope returns the array', () => {
	assert.deepEqual(unwrapEnvelope({ results: ['a', 'b'] }), ['a', 'b']);
});

test('unwrapEnvelope throws on a bare array (the drift shape)', () => {
	assert.throws(() => unwrapEnvelope(['a', 'b']), /DirectoryEnvelopeViolation/);
});

test('unwrapEnvelope throws on missing results', () => {
	assert.throws(() => unwrapEnvelope({}), /DirectoryEnvelopeViolation/);
	assert.throws(() => unwrapEnvelope(null), /DirectoryEnvelopeViolation/);
	assert.throws(() => unwrapEnvelope({ results: 'not-an-array' }), /DirectoryEnvelopeViolation/);
});