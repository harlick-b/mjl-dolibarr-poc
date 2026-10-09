const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getLifecycleBootstrapProfile } = require('../runner/disposable-run');

const repositoryRoot = path.resolve(__dirname, '../..');

test('only lifecycle matrix modes receive an explicit bootstrap profile', () => {
	assert.equal(getLifecycleBootstrapProfile('rst002b'), 'rst002b');
	assert.equal(getLifecycleBootstrapProfile('rst006a'), 'rst006a');
	assert.equal(getLifecycleBootstrapProfile('rst012'), 'rst006b');
	assert.equal(getLifecycleBootstrapProfile('phase3a'), 'rst006b');
	for (const mode of ['all', 'verify', 'e2e', 'auth', 'phase2', 'phase3b', 'phase3c', 'vui12']) {
		assert.equal(getLifecycleBootstrapProfile(mode), '');
	}
});

test('the disposable container receives the narrow profile without the broad test mode', () => {
	const compose = fs.readFileSync(path.join(repositoryRoot, 'tests/fixtures/disposable-compose.override.yml'), 'utf8');
	assert.match(compose, /MJL_LIFECYCLE_BOOTSTRAP_PROFILE:\s*\$\{MJL_LIFECYCLE_BOOTSTRAP_PROFILE\}/);
	assert.doesNotMatch(compose, /^\s*MJL_TEST_MODE:/m);
});
