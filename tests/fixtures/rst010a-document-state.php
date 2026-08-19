<?php

declare(strict_types=1);

if (getenv('MJL_DISPOSABLE_TEST_TENANT') !== '1') {
    fwrite(STDERR, "RST-010A fixtures may run only in a disposable tenant.\n");
    exit(2);
}

$action = $argv[1] ?? '';
if (!in_array($action, ['setup', 'snapshot', 'cleanup'], true)) {
    fwrite(STDERR, "Usage: php rst010a-document-state.php setup|snapshot|cleanup\n");
    exit(2);
}

$databaseName = getenv('DOLI_DB_NAME') ?: 'dolidb';
$databaseHost = getenv('DOLI_DB_HOST') ?: 'mariadb';
$databaseUser = getenv('DOLI_DB_USER') ?: 'dolidbuser';
$databasePassword = getenv('DOLI_DB_PASSWORD') ?: 'poc_pwd';
$documentRoot = '/var/www/documents';
$fixtureRoot = $documentRoot . '/mjl-rst010a-containment';
$fixtureLogin = 'rst010a.e2e.agent';
$fixtureRefPrefix = 'RST010A-';

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $databaseHost, $databaseName),
    $databaseUser,
    $databasePassword,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_STRINGIFY_FETCHES => true,
    ]
);

function removeFixtureTree(string $path): void
{
    if (!file_exists($path) && !is_link($path)) {
        return;
    }
    if (is_link($path) || is_file($path)) {
        unlink($path);
        return;
    }
    foreach (scandir($path) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        removeFixtureTree($path . '/' . $name);
    }
    rmdir($path);
}

function cleanupFixture(PDO $pdo, string $fixtureLogin, string $fixtureRefPrefix, string $fixtureRoot): void
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('DELETE FROM llx_ecm_files WHERE ref LIKE ?');
        $statement->execute([$fixtureRefPrefix . '%']);
        $pdo->exec("DELETE FROM llx_ecm_directories WHERE label='rst010a_fixture' AND description='Disposable RST-010A containment fixture'");
        $statement = $pdo->prepare('SELECT rowid FROM llx_user WHERE login = ?');
        $statement->execute([$fixtureLogin]);
        $userIds = $statement->fetchAll(PDO::FETCH_COLUMN);
        if ($userIds !== []) {
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $pdo->prepare("DELETE FROM llx_mjlfinancement_user_role WHERE fk_user IN ($placeholders)")->execute($userIds);
            $pdo->prepare("DELETE FROM llx_user WHERE rowid IN ($placeholders)")->execute($userIds);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
    removeFixtureTree($fixtureRoot);
}

function createFixture(PDO $pdo, string $fixtureLogin, string $fixtureRefPrefix, string $fixtureRoot): array
{
    cleanupFixture($pdo, $fixtureLogin, $fixtureRefPrefix, $fixtureRoot);

    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            "INSERT INTO llx_user (entity,login,lastname,firstname,email,pass_crypted,statut,admin,datec)
             SELECT 1,?,'RST010A','Agent','rst010a.agent@example.test',pass_crypted,1,0,NOW()
             FROM llx_user WHERE admin=1 ORDER BY rowid LIMIT 1"
        );
        $statement->execute([$fixtureLogin]);
        $userId = (int) $pdo->lastInsertId();
        if ($userId <= 0) {
            throw new RuntimeException('The disposable administrator could not seed the authenticated fixture user.');
        }
        $statement = $pdo->prepare(
            "INSERT INTO llx_mjlfinancement_user_role
             (entity,fk_user,role_code,is_active,date_start,source,date_creation)
             VALUES (1,?,'AGENT_SAISIE',1,NOW(),'rst010a_e2e',NOW())"
        );
        $statement->execute([$userId]);

        $pdo->exec(
            "INSERT INTO llx_ecm_directories
             (label,entity,fk_parent,description,cachenbofdoc,fullpath,date_c,fk_user_c)
             VALUES ('rst010a_fixture',1,NULL,'Disposable RST-010A containment fixture',4,'mjl-rst010a-containment',NOW(),$userId)"
        );

        $rows = [
            ['RST010A-SAME', 'same-entity.txt', null, 1, 'mjl-rst010a-containment/entity-1', 'project', 1001],
            ['RST010A-CROSS', 'cross-entity.txt', null, 2, 'mjl-rst010a-containment/entity-2', 'project', 2002],
            ['RST010A-ORPHAN', 'orphan.txt', null, 1, 'mjl-rst010a-containment/orphan', 'project', 987654321],
            ['RST010A-SHARE', 'public-share.txt', 'rst010a-public-share-token', 1, 'mjl-rst010a-containment/share', 'project', 1001],
        ];
        $insert = $pdo->prepare(
            "INSERT INTO llx_ecm_files
             (ref,label,share,entity,filepath,filename,src_object_type,src_object_id,description,date_c,fk_user_c)
             VALUES (?,?,?,?,?,?,?,?,?,NOW(),?)"
        );
        foreach ($rows as $row) {
            [$ref, $filename, $share, $entity, $filepath, $objectType, $objectId] = $row;
            $insert->execute([$ref, $ref, $share, $entity, $filepath, $filename, $objectType, $objectId, 'Disposable containment canary', $userId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    $canaries = [
        'same' => 'RST010A_CANARY_SAME_ENTITY',
        'cross' => 'RST010A_CANARY_CROSS_ENTITY',
        'orphan' => 'RST010A_CANARY_ORPHAN',
        'share' => 'RST010A_CANARY_PUBLIC_SHARE',
    ];
    $files = [
        'entity-1/same-entity.txt' => $canaries['same'],
        'entity-2/cross-entity.txt' => $canaries['cross'],
        'orphan/orphan.txt' => $canaries['orphan'],
        'share/public-share.txt' => $canaries['share'],
    ];
    foreach ($files as $relativePath => $contents) {
        $fullPath = $fixtureRoot . '/' . $relativePath;
        if (!is_dir(dirname($fullPath)) && !mkdir(dirname($fullPath), 0770, true) && !is_dir(dirname($fullPath))) {
            throw new RuntimeException('Unable to create the disposable document fixture directory.');
        }
        if (file_put_contents($fullPath, $contents . "\n") === false) {
            throw new RuntimeException('Unable to create a disposable document canary.');
        }
    }

    $references = [];
    $statement = $pdo->prepare('SELECT ref,rowid FROM llx_ecm_files WHERE ref LIKE ? ORDER BY ref');
    $statement->execute([$fixtureRefPrefix . '%']);
    foreach ($statement as $row) {
        $references[$row['ref']] = (int) $row['rowid'];
    }

    return ['login' => $fixtureLogin, 'references' => $references, 'canaries' => array_values($canaries)];
}

function filesystemManifest(string $root): array
{
    $manifest = [];
    $walk = function (string $directory, string $relative = '') use (&$walk, &$manifest): void {
        $names = scandir($directory);
        if ($names === false) {
            throw new RuntimeException('Unable to enumerate document storage.');
        }
        foreach ($names as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $path = $directory . '/' . $name;
            $relativePath = $relative === '' ? $name : $relative . '/' . $name;
            if (is_link($path)) {
                $manifest[] = ['path' => $relativePath, 'type' => 'link', 'target' => readlink($path)];
            } elseif (is_dir($path)) {
                $manifest[] = ['path' => $relativePath, 'type' => 'directory'];
                $walk($path, $relativePath);
            } elseif (is_file($path)) {
                $manifest[] = [
                    'path' => $relativePath,
                    'type' => 'file',
                    'size' => filesize($path),
                    'sha256' => hash_file('sha256', $path),
                ];
            } else {
                throw new RuntimeException('Unsupported document-storage entry: ' . $relativePath);
            }
        }
    };
    $walk($root);
    usort($manifest, static fn(array $left, array $right): int => strcmp($left['path'], $right['path']));
    return $manifest;
}

function tableManifest(PDO $pdo, string $table): array
{
    if (!in_array($table, ['llx_ecm_files', 'llx_ecm_directories'], true)) {
        throw new InvalidArgumentException('Unsupported snapshot table.');
    }
    $columns = array_map(
        static fn(array $row): string => $row['Field'],
        $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll()
    );
    $quoted = implode(',', array_map(static fn(string $column): string => "`$column`", $columns));
    $rows = [];
    foreach ($pdo->query("SELECT $quoted FROM `$table` ORDER BY rowid") as $row) {
        $encoded = [];
        foreach ($columns as $column) {
            $encoded[$column] = $row[$column] === null ? null : bin2hex((string) $row[$column]);
        }
        $rows[] = $encoded;
    }
    return ['columns' => $columns, 'rows' => $rows];
}

function canonical(array $value): string
{
    $json = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        throw new RuntimeException('Unable to encode the containment manifest.');
    }
    return $json;
}

if ($action === 'setup') {
    echo canonical(createFixture($pdo, $fixtureLogin, $fixtureRefPrefix, $fixtureRoot)), "\n";
    exit(0);
}

if ($action === 'cleanup') {
    cleanupFixture($pdo, $fixtureLogin, $fixtureRefPrefix, $fixtureRoot);
    echo "{\"cleaned\":true}\n";
    exit(0);
}

$filesystem = filesystemManifest($documentRoot);
$files = tableManifest($pdo, 'llx_ecm_files');
$directories = tableManifest($pdo, 'llx_ecm_directories');
$digests = [
    'filesystem' => hash('sha256', canonical($filesystem)),
    'llx_ecm_files' => hash('sha256', canonical($files)),
    'llx_ecm_directories' => hash('sha256', canonical($directories)),
];
$digests['aggregate'] = hash('sha256', canonical($digests));
echo canonical([
    'filesystem' => ['manifest' => $filesystem, 'sha256' => $digests['filesystem']],
    'ecm' => [
        'llx_ecm_files' => ['manifest' => $files, 'sha256' => $digests['llx_ecm_files']],
        'llx_ecm_directories' => ['manifest' => $directories, 'sha256' => $digests['llx_ecm_directories']],
    ],
    'aggregate_sha256' => $digests['aggregate'],
]), "\n";
