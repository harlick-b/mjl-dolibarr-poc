const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('RST-002B removes Partner scope and replaces it with assignment authorization', () => {
  const scopeLibrary = fs.readFileSync(path.join(root, 'custom/mjlfinancement/lib/mjl_scope.lib.php'), 'utf8');
  const schema = fs.readFileSync(path.join(root, 'custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql'), 'utf8');
  const keys = fs.readFileSync(path.join(root, 'custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql'), 'utf8');

  expect(schema).toContain('CREATE TABLE llx_mjlfinancement_activity_assignment');
  expect(keys).toContain('idx_mjl_activity_assignment_current_agent');
  expect(scopeLibrary).not.toContain('mjlfinancement_user_soc_scope');
  expect(scopeLibrary).toContain('function mjl_scope_has_current_activity_assignment');
  expect(scopeLibrary).toContain('function mjl_scope_assign_access_profile($userId, $roleCode, User $actor');
});
