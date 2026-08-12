const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('RST-002A retains Partner-scope schema but removes it from runtime authorization', () => {
  const scopeLibrary = fs.readFileSync(path.join(root, 'custom/mjlfinancement/lib/mjl_scope.lib.php'), 'utf8');
  const schema = fs.readFileSync(path.join(root, 'custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.sql'), 'utf8');
  const keys = fs.readFileSync(path.join(root, 'custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.key.sql'), 'utf8');

  expect(schema).toContain('CREATE TABLE llx_mjlfinancement_user_soc_scope');
  expect(keys).toContain('idx_mjlfinancement_user_soc_scope_active');
  expect(scopeLibrary).not.toContain('mjlfinancement_user_soc_scope');
  expect(scopeLibrary).not.toContain('function mjl_scope_partner_sql_filter');
  expect(scopeLibrary).not.toContain('function mjl_scope_can_access_object');
  expect(scopeLibrary).toContain('function mjl_scope_assign_access_profile($userId, $roleCode, User $actor');
});
