<?php

declare(strict_types=1);

function evidence_fail(): never
{
    file_put_contents('php://stderr', "Database evidence capture failed.\n");
    exit(2);
}

function evidence_field(HashContext $hash, string $type, mixed $value): void
{
    if ($value === null) {
        hash_update($hash, $type . ':null\n');
        return;
    }
    $bytes = is_string($value) ? $value : (string) $value;
    hash_update($hash, $type . ':' . strlen($bytes) . ':');
    hash_update($hash, $bytes);
    hash_update($hash, "\n");
}

function evidence_identifier(string $value): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $value)) throw new RuntimeException('Unsafe identifier.');
    return '`' . $value . '`';
}

function evidence_restorable_schema_value(string $kind, string $field, mixed $value, string $databaseName, bool $restoreEvidence): mixed
{
    if (!$restoreEvidence || !is_string($value)) return $value;
    $schemaIdentityFields = [
        'TABLE_SCHEMA',
        'TRIGGER_SCHEMA',
        'EVENT_OBJECT_SCHEMA',
        'ROUTINE_SCHEMA',
        'SPECIFIC_SCHEMA',
        'EVENT_SCHEMA',
    ];
    if (in_array($field, $schemaIdentityFields, true) && $value === $databaseName) return 'dolidb';
    if ($kind === 'views' && $field === 'VIEW_DEFINITION') {
        return str_replace('`' . $databaseName . '`.', '`dolidb`.', $value);
    }
    return $value;
}

function evidence_tree_digest(string $root): string
{
    $hash = hash_init('sha256');
    $rootStat = @lstat($root);
    if ($rootStat === false || is_link($root) || !is_dir($root)) throw new RuntimeException('Invalid filesystem evidence root.');
    evidence_field($hash, 'root-path', '.');
    evidence_field($hash, 'root-type', 'directory');
    evidence_field($hash, 'root-mode', ((int) $rootStat['mode']) & 07777);
    $walk = function (string $directory, string $relative = '') use (&$walk, $hash): void {
        $entries = scandir($directory);
        if ($entries === false) throw new RuntimeException('Unable to enumerate filesystem evidence.');
        sort($entries, SORT_STRING);
        foreach ($entries as $name) {
            if ($name === '.' || $name === '..') continue;
            $absolute = $directory . '/' . $name;
            $path = $relative === '' ? $name : $relative . '/' . $name;
            $mode = fileperms($absolute);
            if ($mode === false) throw new RuntimeException('Unable to stat filesystem evidence.');
            if (is_link($absolute)) {
                evidence_field($hash, 'link-path', $path);
                evidence_field($hash, 'link-mode', $mode & 07777);
                evidence_field($hash, 'link-target', readlink($absolute));
            } elseif (is_dir($absolute)) {
                evidence_field($hash, 'dir-path', $path);
                evidence_field($hash, 'dir-mode', $mode & 07777);
                $walk($absolute, $path);
            } elseif (is_file($absolute)) {
                evidence_field($hash, 'file-path', $path);
                evidence_field($hash, 'file-mode', $mode & 07777);
                evidence_field($hash, 'file-size', filesize($absolute));
                $handle = fopen($absolute, 'rb');
                if ($handle === false) throw new RuntimeException('Unable to open filesystem evidence.');
                hash_update_stream($hash, $handle);
                fclose($handle);
            } else {
                throw new RuntimeException('Unsupported filesystem evidence entry.');
            }
        }
    };
    $walk($root);
    return hash_final($hash);
}

try {
    $input = file_get_contents('php://stdin');
    if (PHP_SAPI !== 'cli' || (isset($argc) && $argc !== 1) || ($input !== false && $input !== '')) throw new RuntimeException('Unexpected input.');
    $databaseName = (string) getenv('DOLI_DB_NAME');
    $restoreEvidence = getenv('MJL_RST005_RESTORE_EVIDENCE') === '1';
    if ($databaseName !== 'dolidb' && (!$restoreEvidence || !preg_match('/^rst005_(?:schema|full)_restore_[a-f0-9]{12}$/', $databaseName))) throw new RuntimeException('Unexpected database.');
    if ($restoreEvidence) {
        $sentinel = (string) getenv('MJL_DISPOSABLE_RUN_SENTINEL');
        $sentinelPath = '/var/www/documents/.mjl-disposable-fixture-sentinel';
        $sentinelStat = @lstat($sentinelPath);
        if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1'
            || !preg_match('/^mjl-test-[a-z0-9-]+$/', (string) getenv('MJL_DISPOSABLE_PROJECT_NAME'))
            || !preg_match('/^[a-f0-9]{32}$/', $sentinel)
            || $sentinelStat === false
            || is_link($sentinelPath)
            || !is_file($sentinelPath)
            || (int) $sentinelStat['uid'] !== 0
            || (((int) $sentinelStat['mode']) & 07777) !== 0444
            || !hash_equals($sentinel, (string) @file_get_contents($sentinelPath))) throw new RuntimeException('Restore evidence is restricted to an attested disposable tenant.');
    }
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', (string) getenv('DOLI_DB_HOST'), $databaseName),
        (string) getenv('DOLI_DB_USER'),
        (string) getenv('DOLI_DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_STRINGIFY_FETCHES => false]
    );
    $pdo->exec('SET TRANSACTION READ ONLY');
    $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    $databaseHash = hash_init('sha256');
    $restorableHash = hash_init('sha256');
    $restorableDatabaseDefinitionHash = hash_init('sha256');
    $restorableTableHashes = [];
    $restorableSchemaObjectHashes = [];
    $adminHash = hash_init('sha256');
    $ecmHash = hash_init('sha256');
    $moduleMetadataHash = hash_init('sha256');
    $databaseCreate = $pdo->query('SHOW CREATE DATABASE ' . evidence_identifier($databaseName))->fetch(PDO::FETCH_NUM);
    $createDatabaseSql = (string) ($databaseCreate[1] ?? '');
    if ($restoreEvidence) $createDatabaseSql = str_replace('`' . $databaseName . '`', '`dolidb`', $createDatabaseSql);
    evidence_field($databaseHash, 'create-database', $createDatabaseSql);
    evidence_field($restorableHash, 'create-database', $createDatabaseSql);
    evidence_field($restorableDatabaseDefinitionHash, 'create-database', $createDatabaseSql);
    $tables = $pdo->query("SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE IN ('BASE TABLE','SEQUENCE') ORDER BY TABLE_NAME")->fetchAll();
    $counts = [];
    $schema = [];
    foreach ($tables as $tableDefinition) {
        $table = (string) $tableDefinition['TABLE_NAME'];
        $tableType = (string) $tableDefinition['TABLE_TYPE'];
        $quoted = evidence_identifier($table);
        $columnsStatement = $pdo->prepare('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,GENERATION_EXPRESSION,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION');
        $columnsStatement->execute([$table]);
        $columns = $columnsStatement->fetchAll();
        $columnNames = array_map(static fn(array $column): string => (string) $column['COLUMN_NAME'], $columns);
        $schema[$table] = count($columns);
        $restorableTableHash = hash_init('sha256');
        evidence_field($databaseHash, 'table', $table);
        evidence_field($databaseHash, 'table-type', $tableType);
        evidence_field($restorableHash, 'table', $table);
        evidence_field($restorableHash, 'table-type', $tableType);
        evidence_field($restorableTableHash, 'table', $table);
        evidence_field($restorableTableHash, 'table-type', $tableType);
        foreach ($columns as $column) {
            $encodedColumn = json_encode($column, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            evidence_field($databaseHash, 'column', $encodedColumn);
            evidence_field($restorableHash, 'column', $encodedColumn);
            evidence_field($restorableTableHash, 'column', $encodedColumn);
        }
        $create = $pdo->query('SHOW CREATE TABLE ' . $quoted)->fetch(PDO::FETCH_NUM);
        evidence_field($databaseHash, 'create', $create[1] ?? '');
        evidence_field($restorableHash, 'create', $create[1] ?? '');
        evidence_field($restorableTableHash, 'create', $create[1] ?? '');
        $primaryStatement = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX");
        $primaryStatement->execute([$table]);
        $orderColumns = $primaryStatement->fetchAll(PDO::FETCH_COLUMN) ?: $columnNames;
        $orderSql = $orderColumns === [] ? '' : ' ORDER BY ' . implode(',', array_map('evidence_identifier', $orderColumns));
        $rows = $pdo->query('SELECT * FROM ' . $quoted . $orderSql);
        $count = 0;
        while ($row = $rows->fetch()) {
            $count++;
            foreach ($columnNames as $columnName) {
                evidence_field($databaseHash, 'value', $row[$columnName]);
                evidence_field($restorableHash, 'value', $row[$columnName]);
                evidence_field($restorableTableHash, 'value', $row[$columnName]);
            }
        }
        $counts[$table] = $count;
        $restorableTableHashes[$table] = hash_final($restorableTableHash);
    }
    $schemaObjects = [];
    $objectQueries = [
        'views' => ["SELECT * FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME", 'TABLE_NAME', 'VIEW'],
        'triggers' => ["SELECT * FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME", 'TRIGGER_NAME', 'TRIGGER'],
        'routines' => ["SELECT * FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() ORDER BY ROUTINE_TYPE,ROUTINE_NAME", 'ROUTINE_NAME', null],
        'routine_parameters' => ["SELECT * FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA=DATABASE() ORDER BY SPECIFIC_NAME,ORDINAL_POSITION", null, null],
        'events' => ["SELECT * FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE() ORDER BY EVENT_NAME", 'EVENT_NAME', 'EVENT'],
    ];
    foreach ($objectQueries as $kind => [$query, $nameField, $showKind]) {
        $restorableObjectHash = hash_init('sha256');
        $objects = $pdo->query($query);
        $count = 0;
        while ($object = $objects->fetch()) {
            $count++;
            evidence_field($databaseHash, 'schema-object-kind', $kind);
            evidence_field($restorableHash, 'schema-object-kind', $kind);
            evidence_field($restorableObjectHash, 'schema-object-kind', $kind);
            foreach ($object as $name => $value) {
                evidence_field($databaseHash, 'schema-object-field', $name);
                evidence_field($databaseHash, 'schema-object-value', $value);
                $generatedTimestamp = ($kind === 'triggers' && $name === 'CREATED')
                    || ($kind === 'routines' && in_array($name, ['CREATED', 'LAST_ALTERED'], true))
                    || ($kind === 'events' && in_array($name, ['CREATED', 'LAST_ALTERED', 'LAST_EXECUTED'], true));
                if (!$generatedTimestamp) {
                    $restorableValue = evidence_restorable_schema_value($kind, $name, $value, $databaseName, $restoreEvidence);
                    evidence_field($restorableHash, 'schema-object-field', $name);
                    evidence_field($restorableHash, 'schema-object-value', $restorableValue);
                    evidence_field($restorableObjectHash, 'schema-object-field', $name);
                    evidence_field($restorableObjectHash, 'schema-object-value', $restorableValue);
                }
            }
            if ($nameField !== null) {
                $effectiveKind = $kind === 'routines' ? (string) $object['ROUTINE_TYPE'] : (string) $showKind;
                if (!in_array($effectiveKind, ['VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'EVENT'], true)) throw new RuntimeException('Unexpected schema object type.');
                $created = $pdo->query('SHOW CREATE ' . $effectiveKind . ' ' . evidence_identifier((string) $object[$nameField]))->fetch(PDO::FETCH_ASSOC);
                evidence_field($databaseHash, 'schema-object-create', json_encode(array_values($created), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
                $restorableCreated = $created;
                if ($effectiveKind === 'TRIGGER') unset($restorableCreated['Created']);
                $restorableCreatedJson = json_encode($restorableCreated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                evidence_field($restorableHash, 'schema-object-create', $restorableCreatedJson);
                evidence_field($restorableObjectHash, 'schema-object-create', $restorableCreatedJson);
            }
        }
        $schemaObjects[$kind] = $count;
        $restorableSchemaObjectHashes[$kind] = hash_final($restorableObjectHash);
    }
    $admin = $pdo->query('SELECT * FROM llx_user WHERE admin=1 ORDER BY rowid');
    while ($row = $admin->fetch()) foreach ($row as $name => $value) {
        evidence_field($adminHash, 'name', $name);
        evidence_field($adminHash, 'value', $value);
    }
    foreach (['llx_ecm_files', 'llx_ecm_directories'] as $table) {
        $rows = $pdo->query('SELECT * FROM ' . evidence_identifier($table) . ' ORDER BY rowid');
        while ($row = $rows->fetch()) foreach ($row as $name => $value) {
            evidence_field($ecmHash, $table . '.name', $name);
            evidence_field($ecmHash, $table . '.value', $value);
        }
    }
    $moduleMetadataQueries = [
        'llx_const' => "SELECT * FROM llx_const WHERE name LIKE 'MAIN_MODULE_MJLFINANCEMENT%' OR name LIKE 'MJL_%' ORDER BY rowid",
        'llx_rights_def' => "SELECT * FROM llx_rights_def WHERE module='mjlfinancement' ORDER BY id,entity",
        'llx_menu' => "SELECT * FROM llx_menu WHERE module='mjlfinancement' ORDER BY rowid",
        'llx_user_rights' => "SELECT ur.* FROM llx_user_rights ur INNER JOIN llx_rights_def rd ON rd.id=ur.fk_id AND rd.entity=ur.entity WHERE rd.module='mjlfinancement' ORDER BY ur.entity,ur.fk_user,ur.fk_id",
    ];
    foreach ($moduleMetadataQueries as $table => $query) {
        $rows = $pdo->query($query);
        while ($row = $rows->fetch()) foreach ($row as $name => $value) {
            evidence_field($moduleMetadataHash, $table . '.name', $name);
            evidence_field($moduleMetadataHash, $table . '.value', $value);
        }
    }
    $disposableControlCount = (int) $pdo->query("SELECT COUNT(*) FROM llx_const WHERE entity=0 AND (name='MJL_DISPOSABLE_FIXTURE_SENTINEL' OR name LIKE 'MJL_TEST_FIXTURE_NAMESPACE_%')")->fetchColumn();
    $adminCount = (int) $pdo->query('SELECT COUNT(*) FROM llx_user WHERE admin=1')->fetchColumn();
    $adminIdentity = $pdo->query('SELECT rowid,entity,login,admin,statut FROM llx_user WHERE admin=1 ORDER BY rowid')->fetchAll();
    $businessCounts = [
        'users_non_admin' => (int) $pdo->query('SELECT COUNT(*) FROM llx_user WHERE admin=0')->fetchColumn(),
        'partners' => (int) $pdo->query('SELECT COUNT(*) FROM llx_societe')->fetchColumn(),
        'projects' => (int) $pdo->query('SELECT COUNT(*) FROM llx_projet')->fetchColumn(),
        'ecm_files' => (int) $pdo->query('SELECT COUNT(*) FROM llx_ecm_files')->fetchColumn(),
        'business_roles' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_user_role')->fetchColumn(),
        'partner_scopes' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_user_soc_scope')->fetchColumn(),
        'activities' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_activity')->fetchColumn(),
        'operation_types' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_operation_type')->fetchColumn(),
        'invitations' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_invitation')->fetchColumn(),
        'password_resets' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_password_reset')->fetchColumn(),
        'audit_events' => (int) $pdo->query('SELECT COUNT(*) FROM llx_mjlfinancement_audit_event')->fetchColumn(),
    ];
    $pdo->rollBack();
    echo json_encode([
        'algorithm' => 'sha256',
        'version' => 1,
        'database_sha256' => hash_final($databaseHash),
        'restorable_database_sha256' => hash_final($restorableHash),
        'restorable_database_definition_sha256' => hash_final($restorableDatabaseDefinitionHash),
        'restorable_table_sha256' => $restorableTableHashes,
        'restorable_schema_object_sha256' => $restorableSchemaObjectHashes,
        'admin_sha256' => hash_final($adminHash),
        'ecm_sha256' => hash_final($ecmHash),
        'module_metadata_sha256' => hash_final($moduleMetadataHash),
        'documents_sha256' => evidence_tree_digest('/var/www/documents'),
        'disposable_control_count' => $disposableControlCount,
        'disposable_file_sentinel_present' => file_exists('/var/www/documents/.mjl-disposable-fixture-sentinel'),
        'admin_count' => $adminCount,
        'admin_identity' => $adminIdentity,
        'business_counts' => $businessCounts,
        'table_counts' => $counts,
        'schema_column_counts' => $schema,
        'schema_object_counts' => $schemaObjects,
    ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    evidence_fail();
}
