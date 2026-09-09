const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../..');
const library = `${root}/custom/mjlfinancement/lib/mjl_execution.lib.php`;

function php(expression) {
  return execFileSync('php', ['-r', `require '${root}/custom/mjlfinancement/lib/mjl_presentation.lib.php'; require '${library}'; ${expression}`], { encoding: 'utf8' });
}

test('Phase 3A execution projection follows canonical precedence', () => {
  const cases = [
    [{ latest_validated_amount: null, is_cancelled: 1, date_start: '2026-09-01', date_end: '2026-09-02' }, [], '2026-09-04', 'NOT_STARTED'],
    [{ latest_validated_amount: '100', is_cancelled: 1, date_start: '2026-09-01', date_end: '2026-09-02' }, [{ status: 'COMPLETED' }], '2026-09-04', 'CANCELLED'],
    [{ latest_validated_amount: '100', is_cancelled: 0, date_start: '2026-09-01', date_end: '2026-09-02' }, [{ status: 'CANCELLED' }], '2026-09-04', 'CANCELLED'],
    [{ latest_validated_amount: '100', is_cancelled: 0, date_start: '2026-09-01', date_end: '2026-09-02' }, [{ status: 'COMPLETED' }, { status: 'CANCELLED' }], '2026-09-04', 'COMPLETED'],
    [{ latest_validated_amount: '100', is_cancelled: 0, date_start: '2026-09-01', date_end: '2026-09-04' }, [{ status: 'IN_PROGRESS' }], '2026-09-04', 'IN_PROGRESS'],
    [{ latest_validated_amount: '100', is_cancelled: 0, date_start: '2026-09-01', date_end: '2026-09-04' }, [{ status: 'IN_PROGRESS' }], '2026-09-05', 'OVERDUE'],
    [{ latest_validated_amount: '100', is_cancelled: 0, date_start: '2026-09-06', date_end: '2026-09-10' }, [{ status: 'TODO' }], '2026-09-05', 'UPCOMING'],
  ];
  const output = php(`echo json_encode(array_map(function($c){return mjl_execution_project_status($c[0],$c[1],$c[2]);}, json_decode('${JSON.stringify(cases).replaceAll("'", "\\'")}', true)));`);
  assert.deepEqual(JSON.parse(output), cases.map((entry) => entry[3]));
});

test('Phase 3A completeness and totals preserve missing and explicit zero', () => {
  const operations = [
    { status: 'TODO', authorized_amount: '100', spent_amount: null },
    { status: 'COMPLETED', authorized_amount: '200', spent_amount: '0' },
    { status: 'CANCELLED', authorized_amount: '300', spent_amount: '350' },
    { status: 'CANCELLED', authorized_amount: '400', spent_amount: null },
  ];
  const output = php(`echo json_encode(mjl_execution_summarize(json_decode('${JSON.stringify(operations)}', true)));`);
  assert.deepEqual(JSON.parse(output), {
    completeness: 'PARTIAL',
    explicit_spent_count: 2,
    missing_spent_count: 2,
    cancelled_incomplete_count: 1,
    active_authorized_amount: '300',
    cancelled_authorized_amount: '700',
    active_spent_amount: '0',
    cancelled_spent_amount: '350',
    total_spent_amount: '350',
  });
});

test('Phase 3A variance is integer-safe and formats exact zero distinctly', () => {
  assert.equal(php("echo mjl_execution_variance_percent('150','100');"), '+50,00 %');
  assert.equal(php("echo mjl_execution_variance_percent('0','3');"), '-100,00 %');
  assert.equal(php("echo mjl_execution_variance_percent('7','6');"), '+16,67 %');
  assert.equal(php("echo mjl_execution_variance_percent('9223372036854775807','9223372036854775807');"), '-');
  assert.equal(php("echo mjl_execution_variance_percent(null,'100');"), 'Non renseigné');
  assert.equal(php("echo mjl_execution_variance_amount('150','100');"), '+50 F CFA');
  assert.equal(php("echo mjl_execution_variance_amount('50','100');"), '-50 F CFA');
  assert.equal(php("echo mjl_execution_variance_amount('100','100');"), '-');
  assert.equal(php("echo mjl_execution_variance_amount(null,'100');"), 'Non renseigné');
});

test('Phase 3A derives the Porto-Novo date across the UTC midnight boundary', () => {
  assert.equal(php("echo mjl_execution_porto_novo_date('2032-06-01T22:59:59Z');"), '2032-06-01');
  assert.equal(php("echo mjl_execution_porto_novo_date('2032-06-01T23:00:00Z');"), '2032-06-02');
  const output = php("$date=mjl_execution_porto_novo_date('2032-06-01T23:00:00Z'); echo mjl_execution_project_status(array('latest_validated_amount'=>'1','is_cancelled'=>0,'date_start'=>'2032-06-01','date_end'=>'2032-06-01'),array(array('status'=>'IN_PROGRESS')),$date);");
  assert.equal(output, 'OVERDUE');
});

test('Phase 3A exposes one guarded aggregate mutation seam and exact schema entrypoints', () => {
  const command = fs.readFileSync(`${root}/custom/mjlfinancement/class/mjlactivitycommand.class.php`, 'utf8');
  for (const method of ['updateOperationExecution','requestCancellation','withdrawCancellation','decideCancellation','requestReopening','withdrawReopening','decideReopening','reconcileExecutionStatus']) {
    assert.match(command, new RegExp(`public function ${method}\\(`));
  }
  assert.match(command, /count\(\$input\) !== 3 \|\| array_diff\(array_keys\(\$input\), array\('status','spent_amount','observation'\)\)/);
  assert.match(command, /hasPendingOperationException/);
  assert.match(command, /operationSetHash/);
  assert.match(command, /ACTIVITY_EXECUTION_STATUS_CHANGED/);
  assert.match(command, /fk_target_revision/);
  assert.match(command, /\$activity\['fk_current_revision'\].*\$request\['fk_target_revision'\]/s);

  const schema = fs.readFileSync(`${root}/custom/mjlfinancement/scripts/rst006b_schema.lib.php`, 'utf8');
  assert.match(schema, /chk_mjl_activity_rst006b_phase3a/);
  assert.match(schema, /chk_mjl_operation_execution_shape/);
  assert.match(schema, /RST006B_SCHEMA_PREDECESSOR/);
  assert.match(schema, /mjl_rst006b_rollback_target/);
  assert.match(schema, /mjl_rst006b_table_contracts/);
  assert.match(schema, /mjl_rst006b_require_trigger_contract/);
  assert.match(schema, /mjl_rst006a_require_new_table_contract/);

  const migration = fs.readFileSync(`${root}/custom/mjlfinancement/scripts/rst006b_execution.php`, 'utf8');
  assert.match(migration, /cancellation_request-fk-/);
  assert.match(migration, /reopening_request-fk-/);

  const module = fs.readFileSync(`${root}/custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, 'utf8');
  assert.match(module, /version = '0\.20\.0'/);
  assert.match(module, /MjlExecutionReconciler/);
  assert.match(module, /unitfrequency' => 3600/);
  assert.ok(module.indexOf("if ($migrationRequired) return 'RST006B_MIGRATION_REQUIRED'") < module.indexOf('$this->_init('));
  assert.doesNotMatch(module, /elseif \(\$schema === RST006A_SCHEMA_PREDECESSOR\)/);
});
