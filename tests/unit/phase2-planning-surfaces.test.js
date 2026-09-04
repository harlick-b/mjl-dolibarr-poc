const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('RST-007B maps a closed Activity audit vocabulary without exposing raw JSON', () => {
  const php = `require '${root}/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php'; echo json_encode([
    mjl_timeline_present_event(['action'=>'ACTIVITY_CREATED','actor_name_snapshot'=>'Awa','actor_role_snapshot'=>'AGENT_SAISIE','event_date'=>'2026-09-04 10:00:00','state_after'=>'DRAFT']),
    mjl_timeline_present_event(['action'=>'ACTIVITY_CREATED','actor_name_snapshot'=>'Awa','event_date'=>'2026-09-04 10:01:00','context_json'=>'{malformed']),
    mjl_timeline_present_event(['action'=>'UNKNOWN_EVENT','actor_name_snapshot'=>'Awa','event_date'=>'2026-09-04 10:02:00','context_json'=>'{"secret":"x"}']),
    mjl_timeline_present_event(['action'=>'ACTIVITY_REVIEW_DECIDED','actor_name_snapshot'=>'Bio','actor_role_snapshot'=>'VALIDATEUR_DEFINITIF','event_date'=>'2026-09-04 10:03:00','context_json'=>'{"revision_number":2,"decision":"RETURNED_VALIDATOR","requested_amount":"2500"}']),
    mjl_timeline_present_event(['action'=>'ACTIVITY_STRUCTURE_SAVED','actor_name_snapshot'=>'Awa','event_date'=>'2026-09-04 10:04:00','previous_values_json'=>'{"activity":{"name":"Avant"},"operations":[{"name":"A"}]}','new_values_json'=>'{"activity":{"name":"Après"},"operations":[{"name":"A"},{"name":"B"}]}'])
  ]);`;
  const events = JSON.parse(execFileSync('php', ['-r', php], { encoding: 'utf8' }));
  assert.equal(events[0].title, 'Activité créée');
  assert.equal(events[0].actor, 'Awa');
  assert.equal(events[0].role, 'Agent de saisie');
  assert.match(events[0].date, /^04\/09\/2026/);
  assert.equal(events[1].title, 'Événement enregistré');
  assert.doesNotMatch(JSON.stringify(events[1]), /malformed|context_json|ACTIVITY_CREATED/);
  assert.equal(events[2].title, 'Événement enregistré');
  assert.doesNotMatch(JSON.stringify(events[2]), /secret|UNKNOWN_EVENT/);
  assert.match(events[3].detail, /Révision 2.*Retour en correction.*2 500 F CFA/);
  assert.match(events[4].detail, /nom.*Opérations : 1 → 2/);

	const moneyPhp = `require '${root}/custom/mjlfinancement/lib/mjl_presentation.lib.php'; echo mjl_format_money('9223372036854775807');`;
	assert.equal(execFileSync('php', ['-r', moneyPhp], { encoding: 'utf8' }), '9 223 372 036 854 775 807 F CFA');
	const negativeZeroPhp = `require '${root}/custom/mjlfinancement/lib/mjl_presentation.lib.php'; echo mjl_format_money('-0');`;
	assert.equal(execFileSync('php', ['-r', negativeZeroPhp], { encoding: 'utf8' }), '0 F CFA');
	const unknownStatePhp = `require '${root}/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php'; echo mjl_timeline_state_label('FUTURE_STATE');`;
	assert.equal(execFileSync('php', ['-r', unknownStatePhp], { encoding: 'utf8' }), 'Statut non reconnu');

  const assignmentPhp = `require '${root}/custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php'; echo json_encode(mjl_timeline_present_event(['action'=>'ASSIGNMENT_ADDED','actor_name_snapshot'=>'Awa','event_date'=>'2026-09-04 10:02:00','context_json'=>'{"target_agent_name":"Moussa Bio"}']));`;
  const assignment = JSON.parse(execFileSync('php', ['-r', assignmentPhp], { encoding: 'utf8' }));
  assert.match(assignment.detail, /Moussa Bio/);
});

test('RST-007B chronology is active-entity Activity scoped and rendered on detail and review', () => {
  const loader = read('custom/mjlfinancement/lib/mjl_timeline.lib.php');
  const route = read('custom/mjlfinancement/lib/mjl_activity_route.lib.php');
  const command = read('custom/mjlfinancement/class/mjlactivitycommand.class.php');
  assert.match(loader, /result='SUCCESS'/);
  assert.match(loader, /activity_id=/);
  assert.match(loader, /entity=/);
  assert.match(loader, /ORDER BY event_date,rowid/);
  assert.match(loader, /mjl_timeline_aggregate_sources/);
  assert.ok((route.match(/mjl_activity_render_timeline\(/g) || []).length >= 2);
  assert.match(command, /'revision_id'=>!empty\(\$context\['revision_id'\]\)/);
  assert.match(command, /previous_values/);
  assert.match(command, /requested_amount/);
});

test('RST-009B exposes only read-only Planification routes with assignment scoping', () => {
  const registry = read('custom/mjlfinancement/lib/mjl_navigation_registry.lib.php');
  const route = read('custom/mjlfinancement/operations.php') + read('custom/mjlfinancement/lib/mjl_operation_route.lib.php');
  assert.match(registry, /'planification'/);
  assert.match(registry, /'activities'/);
  assert.match(registry, /'operations'/);
  assert.match(route, /REQUEST_METHOD.*GET/s);
  assert.match(route, /date_removed IS NULL/);
  assert.match(route, /LIMIT 51 OFFSET/);
  assert.match(route, /partner_name/);
  assert.match(route, /project_title/);
  assert.match(route, /mjl_format_money/);
  assert.match(route, /activity_assignment/);
  assert.match(route, /fk_user=/);
  assert.match(route, /mjl_ui_system_state\('unavailable'/);
  assert.doesNotMatch(route, /<form|\$_POST|INSERT|UPDATE|DELETE/);
  assert.doesNotMatch(route, /<main class=/);
});

test('Phase 2 acceptance runs after its foundational RST-006A suite', () => {
  const config = read('playwright.config.js');
  assert.ok(config.indexOf('rst006a-activity-planning.spec.js') < config.indexOf('zz-phase2-planning.spec.js'));
  const runner = read('tests/runner/run-suite.js');
  assert.match(runner, /rst006a-activity-planning\.spec\.js', 'tests\/e2e\/zz-phase2-planning\.spec\.js/);
});

test('RST-014B reuses disposable attestation and assignment commands', () => {
  const helper = read('tests/helpers/phase2-fixture.js');
  const fixture = read('tests/fixtures/phase2-fixture.php');
  assert.match(fixture, /phase1-fixture-preflight\.php/);
  assert.match(fixture, /MJL_DISPOSABLE_FIXTURE_SENTINEL/);
  assert.match(fixture, /MjlActivityAssignment/);
  assert.match(helper, /additionalAgentKeys/);
  assert.match(helper, /Object\.keys\(decoded\)/);
});
