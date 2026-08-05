const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const tokenRoot = path.join(root, 'docs/design-system/approved/v3/design-tokens');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(tokenRoot, name), 'utf8'));
}

function getPath(source, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => value && value[key], source);
}

function resolveAliases(base, semantic) {
  const combined = { ...base, ...semantic };
  const visit = (value, seen = new Set()) => {
    if (Array.isArray(value)) return value.map((entry) => visit(entry, seen));
    if (!value || typeof value !== 'object') return value;
    if (Object.hasOwn(value, '$value')) {
      const tokenValue = value.$value;
      const match = typeof tokenValue === 'string' && tokenValue.match(/^\{([^}]+)\}$/);
      if (!match) return visit(tokenValue, seen);
      assert.equal(seen.has(match[1]), false, `circular token alias: ${match[1]}`);
      const target = getPath(combined, match[1]);
      assert.notEqual(target, undefined, `unresolved token alias: ${match[1]}`);
      return visit(target, new Set([...seen, match[1]]));
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child, seen)]));
  };
  return visit(combined);
}

test('approved v3 tokens define the Inter refinement and every semantic alias resolves', () => {
  const base = readJson('tokens.json');
  const semantic = readJson('semantic-tokens.json');
  const resolved = resolveAliases(base, semantic);

  assert.deepEqual(resolved.font.family.sans, ['Inter', 'Arial', 'Helvetica', 'sans-serif']);
  assert.equal(resolved.font.weight.regular, 400);
  assert.equal(resolved.font.weight.medium, 500);
  assert.equal(resolved.font.weight.semibold, 600);
  assert.equal(resolved.font.weight.bold, 700);
  assert.equal(resolved.size.controlCompact, '32px');
  assert.equal(resolved.size.controlStandard, '40px');
  assert.equal(resolved.size.touchTarget, '44px');
  assert.equal(resolved.radius.control, '10px');
  assert.equal(resolved.radius.statusBadge, '6px');
  assert.equal(resolved.radius.pill, '999px');
  assert.equal(resolved.table.rowData, '40px');
  assert.equal(resolved.table.rowInteractive, '44px');
  assert.equal(resolved.size.statusBadgeMin, '20px');
  assert.equal(resolved.size.switch.width, '24px');
  assert.equal(resolved.size.switch.height, '14px');
  assert.equal(resolved.size.switch.thumb, '10px');
  assert.equal(resolved.semantic.status.success.badgeSurface, '#caface');
  assert.equal(resolved.semantic.component.controlBorder, '#5c6870');
  assert.equal(resolved.semantic.component.tableRowData, '40px');
  assert.equal(resolved.semantic.component.tableRowInteractive, '44px');

  const appCss = fs.readFileSync(path.join(root, 'custom/mjlfinancement/css/mjl_app.css.php'), 'utf8');
  const authCss = fs.readFileSync(path.join(root, 'custom/mjlfinancement/css/mjl_auth.css.php'), 'utf8');
  const runtimeMappings = new Map([
    ['--mjl-font-sans', resolved.font.family.sans.join(', ')],
    ['--mjl-color-border-strong', resolved.color.border.strong],
    ['--mjl-color-status-success-badge-surface', resolved.color.status.successBadgeSurface],
    ['--mjl-color-status-warning', resolved.color.status.warningText],
    ['--mjl-color-status-warning-surface', resolved.color.status.warningSurface],
    ['--mjl-color-status-danger', resolved.color.status.dangerText],
    ['--mjl-color-status-danger-surface', resolved.color.status.dangerSurface],
    ['--mjl-radius-control', resolved.radius.control],
    ['--mjl-radius-status-badge', resolved.radius.statusBadge],
    ['--mjl-radius-pill', resolved.radius.pill],
    ['--mjl-control-compact', resolved.size.controlCompact],
    ['--mjl-control-standard', resolved.size.controlStandard],
    ['--mjl-touch-target', resolved.size.touchTarget],
    ['--mjl-row-data', resolved.table.rowData],
    ['--mjl-row-interactive', resolved.table.rowInteractive],
  ]);
  for (const [property, value] of runtimeMappings) {
    assert.ok(appCss.includes(`${property}: ${value};`), `${property} does not map the canonical token`);
  }
  assert.ok(authCss.includes(`font-family: ${resolved.font.family.sans.join(', ')};`));
  assert.ok(authCss.includes(`border-radius: ${resolved.radius.control};`));
  assert.ok(authCss.includes(`min-height: ${resolved.size.touchTarget};`));
});

test('v3 is the sole active design generation and font loading stays inside the approved boundary', () => {
  const designRoot = path.join(root, 'docs/design-system');
  const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
  const readme = read('docs/design-system/README.md');
  const hook = read('custom/mjlfinancement/class/actions_mjlfinancement.class.php');
  const appCss = read('custom/mjlfinancement/css/mjl_app.css.php');
  const authCss = read('custom/mjlfinancement/css/mjl_auth.css.php');

  for (const relative of [
    'PRODUCT.md',
    'DESIGN.md',
    'MANUAL-REVIEW.md',
    'design-manifest.yaml',
    'design-tokens/README.md',
    'design-tokens/tokens.json',
    'design-tokens/semantic-tokens.json',
    'docs/design/component-inventory.md',
    'docs/design/design-assumptions.md',
    'docs/design/design-decisions.md',
    'docs/design/design-validation-report.md',
  ]) {
    assert.equal(fs.existsSync(path.join(designRoot, 'approved/v3', relative)), true, relative);
  }

  assert.equal(fs.existsSync(path.join(designRoot, 'approved/v2')), false);
  assert.match(readme, /Active approved design generation: v3/);
  assert.doesNotMatch(readme, /approved\/v2/);
  assert.equal((hook.match(/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700/g) || []).length, 1);
  assert.match(hook, /fonts\.gstatic\.com/);
  assert.doesNotMatch(hook, /integrity=|<script|@import/i);
  assert.match(appCss, /--mjl-font-sans: Inter, Arial, Helvetica, sans-serif/);
  assert.match(appCss, /--mjl-color-status-success-badge-surface: #caface/);
  assert.match(appCss, /\(any-pointer: coarse\)/);
  assert.match(appCss, /@media print/);
  assert.match(authCss, /font-family: Inter, Arial, Helvetica, sans-serif/);
});

test('active design authority and deployment language remain aligned with phase 3D.4', () => {
  const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
  const authority = read('docs/mjl-authoritative-decisions.md');
  const durableDesign = read('DESIGN.md');
  const designContext = read('docs/design-context.md');
  const gapAnalysis = read('docs/mjl-current-vs-target-gap-analysis.md');
  const docsIndex = read('docs/mjl-docs-index.md');
  const manifest = read('docs/design-system/approved/v3/design-manifest.yaml');
  const v3Design = read('docs/design-system/approved/v3/DESIGN.md');

  assert.match(authority, /approved\/v3.*presentation authority/i);
  assert.match(authority, /subordinate\s+to business.*security.*permissions.*workflows/i);
  assert.match(docsIndex, /approved MJL Financement v3 design documentation/);
  assert.doesNotMatch(docsIndex, /approved MJL Financement v2 design documentation/);
  assert.match(manifest, /^\s*policy: approved-cdn-with-system-fallback\s*$/m);
  assert.match(v3Design, /DS3-008/);
  assert.match(v3Design, /unavailable or unauthorized links are omitted/i);

  for (const [relative, source] of [
    ['docs/mjl-authoritative-decisions.md', authority],
    ['DESIGN.md', durableDesign],
    ['docs/design-context.md', designContext],
    ['docs/mjl-current-vs-target-gap-analysis.md', gapAnalysis],
    ['docs/mjl-docs-index.md', docsIndex],
  ]) {
    assert.doesNotMatch(source, /production-ready/i, `${relative} claims production readiness`);
    assert.doesNotMatch(source, /approved\/v2/i, `${relative} contains an active v2 reference`);
  }

  assert.match(authority, /production-quality target[\s\S]*deployment readiness is not established/i);
  assert.doesNotMatch(durableDesign, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(durableDesign, /recommended token/i);
  assert.doesNotMatch(durableDesign, /3px solid/i);
});

test('v3 interactive-state and compact-control contracts are explicit in runtime CSS', () => {
  const appCss = fs.readFileSync(path.join(root, 'custom/mjlfinancement/css/mjl_app.css.php'), 'utf8');
  const authCss = fs.readFileSync(path.join(root, 'custom/mjlfinancement/css/mjl_auth.css.php'), 'utf8');

  assert.match(appCss, /@media \(hover: hover\)[\s\S]*\.mjl-card-link:hover/);
  assert.match(appCss, /@media \(hover: hover\)[\s\S]*\.mjl-nav-card:hover/);
  assert.match(appCss, /\.mjl-card-link:active/);
  assert.match(appCss, /\.mjl-nav-card:active/);
  assert.match(authCss, /@media \(hover: hover\)[\s\S]*\.mjl-auth-link:hover/);
  assert.match(authCss, /\.mjl-auth-link:active/);
  const hoverMediaOffset = appCss.indexOf('@media (hover: hover)');
  for (const selector of [
    '.mjl-sidebar-link:hover',
    '.mjl-sidebar-child-link:hover',
    '.mjl-tabs a:hover',
    '.mjl-table-action-menu-item:hover',
  ]) {
    assert.ok(appCss.indexOf(selector) > hoverMediaOffset, `${selector} must be hover-capability gated`);
  }
  for (const selector of [
    '.mjl-sidebar-link:active',
    '.mjl-tabs a:active',
    '.mjl-navigation-trigger:active',
    '.mjl-navigation-close:active',
    '.mjl-table-action-menu > summary:active',
    '.mjl-table-action-menu-item:active',
  ]) {
    assert.ok(appCss.includes(selector), `${selector} active state missing`);
  }
  assert.doesNotMatch(appCss, /\.mjl-report-filter-bar[^}]*min-height:\s*34px/s);
  assert.doesNotMatch(appCss, /\.mjl-activity-(?:form|action-form)[^}]*min-height:\s*34px/s);
  assert.match(appCss, /\.mjl-navigation-trigger[^{]*\{[^}]*box-sizing:\s*border-box[^}]*height:\s*var\(--mjl-control-compact\)\s*!important/s);
  assert.match(appCss, /@media \(any-pointer: coarse\)[\s\S]*\.mjl-navigation-trigger[^{]*\{[^}]*min-height:\s*var\(--mjl-touch-target\)\s*!important/s);
});

test('authentication error surfaces expose assertive announcement semantics', () => {
  for (const template of ['login.tpl.php', 'passwordreset.tpl.php']) {
    const source = fs.readFileSync(path.join(root, 'custom/mjlfinancement/core/tpl', template), 'utf8');
    assert.match(source, /mjl-auth-error[^>]*role="alert"[^>]*aria-live="assertive"/, template);
  }
  const forgotten = fs.readFileSync(path.join(root, 'custom/mjlfinancement/core/tpl/passwordforgotten.tpl.php'), 'utf8');
  assert.match(forgotten, /mjl-auth-message[^>]*role="status"[^>]*aria-live="polite"/);
  const invitation = fs.readFileSync(path.join(root, 'custom/mjlfinancement/invitation.php'), 'utf8');
  assert.equal((invitation.match(/mjl-auth-error" role="alert" aria-live="assertive"/g) || []).length, 5);
  assert.match(invitation, /mjl-auth-message" role="status" aria-live="polite"/);
});
