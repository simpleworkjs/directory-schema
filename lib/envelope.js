'use strict';

/**
 * The discovery API response envelope: every list/detail endpoint returns
 * `{ results: [...] }`. jump-host's client does `data.results || []`, so a bare
 * array (the pre-fix autoRouter shape) silently collapsed to `[]` — no user
 * could bridge. Centralizing the envelope here + validating it in the client
 * makes that drift a loud error instead of an empty list.
 */

function envelope(results){ return { results }; }

function unwrapEnvelope(body){
	if (!body || !Array.isArray(body.results)) {
		const err = new Error('DirectoryEnvelopeViolation');
		err.name = 'DirectoryEnvelopeViolation';
		err.message = 'Expected { results: [...] } from the directory API';
		throw err;
	}
	return body.results;
}

module.exports = { envelope, unwrapEnvelope };