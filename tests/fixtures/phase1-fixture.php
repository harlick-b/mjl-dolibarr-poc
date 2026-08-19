<?php

declare(strict_types=1);

$sentinel = require __DIR__ . '/phase1-fixture-preflight.php';

const MJL_FIXTURE_MAX_BYTES = 16384;
const MJL_FIXTURE_ROLES = [null, 'AGENT_SAISIE', 'AGENT_VERIFICATEUR', 'VALIDATEUR_DEFINITIF'];

function mjl_fixture_fail(): never
{
    fwrite(STDERR, "Phase 1 disposable fixture creation failed.\n");
    exit(2);
}

function mjl_fixture_exact_keys(object $value, array $expected): void
{
    if (array_keys(get_object_vars($value)) !== $expected) {
        throw new InvalidArgumentException('Invalid object shape.');
    }
}

function mjl_fixture_key(mixed $value, array &$seen): string
{
    if (!is_string($value)
        || !preg_match('/^[a-z][a-z0-9-]{0,19}$/', $value)
        || in_array($value, ['constructor', 'prototype'], true)
        || isset($seen[$value])
    ) {
        throw new InvalidArgumentException('Invalid fixture key.');
    }
    $seen[$value] = true;
    return $value;
}

function mjl_fixture_label(mixed $value): string
{
    if (!is_string($value)
        || $value === ''
        || preg_match('/^[\p{Z}\x{0009}-\x{000D}]|[\p{Z}\x{0009}-\x{000D}]$/u', $value)
        || !Normalizer::isNormalized($value, Normalizer::FORM_C)
        || preg_match('/[\x{0000}-\x{001F}\x{007F}-\x{009F}]/u', $value)
        || mb_strlen($value, 'UTF-8') > 112
    ) {
        throw new InvalidArgumentException('Invalid fixture label.');
    }
    return $value;
}

function mjl_fixture_digest(string $namespace, string $kind, string $key): string
{
    return hash('sha256', $namespace . "\0" . $kind . "\0" . $key);
}

try {
    $raw = stream_get_contents(STDIN, MJL_FIXTURE_MAX_BYTES + 1);
    if (!is_string($raw) || $raw === '' || strlen($raw) > MJL_FIXTURE_MAX_BYTES) {
        throw new InvalidArgumentException('Invalid request size.');
    }
    $request = json_decode($raw, false, 8, JSON_THROW_ON_ERROR);
    if (!$request instanceof stdClass
        || json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) !== $raw
    ) {
        throw new InvalidArgumentException('Request is not canonical JSON.');
    }
    mjl_fixture_exact_keys($request, ['namespace', 'entity', 'users', 'references']);
    if (!is_string($request->namespace)
        || !preg_match('/^[a-z0-9](?:[a-z0-9.-]{0,22}[a-z0-9])?$/', $request->namespace)
        || !is_int($request->entity)
        || $request->entity <= 0
        || $request->entity > 2147483647
        || !is_array($request->users)
        || count($request->users) < 1
        || count($request->users) > 8
        || !$request->references instanceof stdClass
    ) {
        throw new InvalidArgumentException('Invalid fixture request.');
    }
    mjl_fixture_exact_keys($request->references, ['partners', 'projects', 'operationTypes']);

    $seenUsers = [];
    $users = [];
    foreach ($request->users as $user) {
        if (!$user instanceof stdClass) throw new InvalidArgumentException('Invalid user.');
        mjl_fixture_exact_keys($user, ['key', 'role']);
        $key = mjl_fixture_key($user->key, $seenUsers);
        if (!in_array($user->role, MJL_FIXTURE_ROLES, true)) throw new InvalidArgumentException('Invalid role.');
        $users[] = ['key' => $key, 'role' => $user->role];
    }

    $seenReferences = [];
    $partnerKeys = [];
    $references = ['partners' => [], 'projects' => [], 'operationTypes' => []];
    foreach (array_keys($references) as $collection) {
        $entries = $request->references->{$collection};
        if (!is_array($entries) || count($entries) > 8) throw new InvalidArgumentException('Invalid references.');
        foreach ($entries as $entry) {
            if (!$entry instanceof stdClass) throw new InvalidArgumentException('Invalid reference.');
            mjl_fixture_exact_keys($entry, $collection === 'projects' ? ['key', 'label', 'partnerKey'] : ['key', 'label']);
            $key = mjl_fixture_key($entry->key, $seenReferences);
            $record = ['key' => $key, 'label' => mjl_fixture_label($entry->label)];
            if ($collection === 'partners') $partnerKeys[$key] = true;
            if ($collection === 'projects') {
                if (!is_string($entry->partnerKey) || !isset($partnerKeys[$entry->partnerKey])) throw new InvalidArgumentException('Invalid project parent.');
                $record['partnerKey'] = $entry->partnerKey;
            }
            $references[$collection][] = $record;
        }
    }
    if (array_sum(array_map('count', $references)) > 0
        && !array_filter($users, static fn(array $user): bool => $user['role'] === 'VALIDATEUR_DEFINITIF')
    ) {
        throw new InvalidArgumentException('References require a Validator.');
    }

    $password = (string) getenv('MJL_TEST_USER_PASSWORD');
    if (!preg_match('/^[A-Za-z0-9_-]{32}$/', $password)) throw new RuntimeException('Missing fixture credential.');
    define('NOLOGIN', 1);
    require_once '/var/www/html/main.inc.php';
    $passwordHash = dol_hash($password, '0');
    if (!is_string($passwordHash) || $passwordHash === '') throw new RuntimeException('Unable to hash fixture credential.');

    $databaseName = (string) getenv('DOLI_DB_NAME');
    if ($databaseName !== 'dolidb') throw new RuntimeException('Unexpected database.');
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', (string) getenv('DOLI_DB_HOST'), $databaseName),
        (string) getenv('DOLI_DB_USER'),
        (string) getenv('DOLI_DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_STRINGIFY_FETCHES => false]
    );
    $sentinelStatement = $pdo->prepare("SELECT value FROM llx_const WHERE entity=0 AND name='MJL_DISPOSABLE_FIXTURE_SENTINEL'");
    $sentinelStatement->execute();
    if (!hash_equals($sentinel, (string) $sentinelStatement->fetchColumn())) throw new RuntimeException('Database sentinel mismatch.');
    $pdo->beginTransaction();
    $reservationName = 'MJL_TEST_FIXTURE_NAMESPACE_' . hash('sha256', $request->namespace);
    $reservation = $pdo->prepare("INSERT INTO llx_const(name,value,type,visible,note,entity) VALUES(?,?,'chaine',0,'Disposable Phase 1 fixture namespace',0)");
    $reservation->execute([$reservationName, $request->namespace]);

    $result = ['users' => [], 'partners' => [], 'projects' => [], 'operationTypes' => []];
    $insertUser = $pdo->prepare(
        'INSERT INTO llx_user(entity,login,lastname,firstname,email,pass,pass_crypted,pass_temp,statut,admin,datec) VALUES(?,?,?,?,?,NULL,?,NULL,1,0,NOW())'
    );
    $insertRole = $pdo->prepare(
        'INSERT INTO llx_mjlfinancement_user_role(entity,fk_user,role_code,is_active,date_start,source,date_creation) VALUES(?,?,?,1,NOW(),?,NOW())'
    );
    foreach ($users as $user) {
        $login = $request->namespace . '.' . $user['key'];
        $insertUser->execute([$request->entity, $login, 'Fixture', ucfirst($user['key']), $login . '@example.test', $passwordHash]);
        $userId = (int) $pdo->lastInsertId();
        if ($userId <= 0) throw new RuntimeException('Invalid user identifier.');
        if ($user['role'] !== null) $insertRole->execute([$request->entity, $userId, $user['role'], 'rst014a_fixture']);
        $result['users'][$user['key']] = ['id' => $userId, 'login' => $login];
    }
    $validatorKeys = array_column(array_values(array_filter($users, static fn(array $user): bool => $user['role'] === 'VALIDATEUR_DEFINITIF')), 'key');
    sort($validatorKeys, SORT_STRING);
    $creatorId = $validatorKeys === [] ? 0 : (int) $result['users'][$validatorKeys[0]]['id'];

    $insertPartner = $pdo->prepare('INSERT INTO llx_societe(entity,nom,code_client,status,client,fournisseur,datec,fk_user_creat) VALUES(?,?,?,1,0,0,NOW(),?)');
    foreach ($references['partners'] as $reference) {
        $digest = mjl_fixture_digest($request->namespace, 'partner', $reference['key']);
        $insertPartner->execute([$request->entity, $reference['label'] . ' [' . substr($digest, 0, 12) . ']', 'T' . substr($digest, 0, 23), $creatorId]);
        $result['partners'][$reference['key']] = (int) $pdo->lastInsertId();
    }
    $insertProject = $pdo->prepare('INSERT INTO llx_projet(entity,ref,title,fk_soc,fk_statut,datec,fk_user_creat) VALUES(?,?,?,?,1,NOW(),?)');
    foreach ($references['projects'] as $reference) {
        $digest = mjl_fixture_digest($request->namespace, 'project', $reference['key']);
        $insertProject->execute([$request->entity, 'MJL-T-' . substr($digest, 0, 44), $reference['label'] . ' [' . substr($digest, 0, 12) . ']', $result['partners'][$reference['partnerKey']], $creatorId]);
        $result['projects'][$reference['key']] = (int) $pdo->lastInsertId();
    }
    $insertType = $pdo->prepare('INSERT INTO llx_mjlfinancement_operation_type(entity,label,is_active,date_creation,fk_user_creat) VALUES(?,?,1,NOW(),?)');
    foreach ($references['operationTypes'] as $reference) {
        $digest = mjl_fixture_digest($request->namespace, 'operationType', $reference['key']);
        $insertType->execute([$request->entity, $reference['label'] . ' [' . substr($digest, 0, 12) . ']', $creatorId]);
        $result['operationTypes'][$reference['key']] = (int) $pdo->lastInsertId();
    }
    $pdo->commit();
    foreach (['users', 'partners', 'projects', 'operationTypes'] as $collection) $result[$collection] = (object) $result[$collection];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    mjl_fixture_fail();
}
