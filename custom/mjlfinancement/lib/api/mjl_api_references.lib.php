<?php
require_once DOL_DOCUMENT_ROOT.'/custom/mjlfinancement/lib/mjl_reference.lib.php';

/** Map scoped reference reads to REST responses. */
function mjl_api_reference_read($kind, User $actor, $id = null, $page = 1, $partnerId = null)
{
 global $db;
 $manage = mjl_reference_can_manage($actor);
 $config = mjl_reference_config($kind);
 $result = mjl_reference_read_page($db, mjl_auth_entity(), $manage, $kind, $id, $page, $partnerId);
 if ($id !== null && !$result['data']) mjl_api_fail(404, 'not_found');
 foreach ($result['data'] as &$row) {
  $name = $config['operation'];
  $row['allowed_actions'] = $manage ? array('get'.$name, 'rename'.$name, 'set'.$name.'Active') : array('get'.$name);
 }
 unset($row);
 return $id !== null ? array('data' => $result['data'][0]) : $result;
}

function mjl_api_reference_context($kind, $action, $id, User $actor)
{
 return array('user_id' => (int) $actor->id, 'entity' => mjl_auth_entity(), 'route' => 'api_'.$kind, 'form' => 'reference', 'action' => $action, 'object_id' => (int) $id);
}

function mjl_api_references(array $request, User $actor)
{
 global $db;
 if (!mjl_scope_user_has_active_business_role($actor)) mjl_api_fail(403, 'forbidden');
 $path = $request['path'];
 $method = $request['method'];
 $body = $request['body'];
 $kinds = array('partners' => 'partner', 'projects' => 'project', 'operation-types' => 'operation_type');
 if ($path === '/submission-tokens') {
  if (!mjl_reference_can_manage($actor)) mjl_api_fail(403, 'forbidden');
  mjl_api_fields($body, array('operation_id', 'path_parameters'));
  $operations = array();
  foreach ($kinds as $kind) {
   $name = mjl_reference_config($kind)['operation'];
   foreach (array('create'.$name, 'rename'.$name, 'set'.$name.'Active') as $operation) $operations[$operation] = $kind;
  }
  if (!is_string($body->operation_id) || !isset($operations[$body->operation_id])) mjl_api_fail(400, 'invalid_request');
  $kind = $operations[$body->operation_id];
  $creating = strpos($body->operation_id, 'create') === 0;
  mjl_api_fields($body->path_parameters, $creating ? array() : array('id'));
  $id = $creating ? '0' : mjl_api_id($body->path_parameters->id);
  if (!$creating) mjl_api_reference_read($kind, $actor, $id);
  $token = mjl_form_submission_issue(mjl_api_reference_context($kind, $body->operation_id, $id, $actor));
  if ($token === '') mjl_api_fail(503, 'unavailable');
  $expires = min(time() + MJL_FORM_SUBMISSION_TTL, mjl_auth_session_value('mjl_authenticated_at') + 86400, mjl_auth_session_value('mjl_last_activity_at') + 86400);
  return array(200, array('data' => array('token' => $token, 'expires_at' => gmdate('c', $expires))));
 }
 $parts = explode('/', $path);
 $kind = $kinds[$parts[1]];
 $config = mjl_reference_config($kind);
 $id = isset($parts[2]) ? mjl_api_id($parts[2]) : null;
 if ($method === 'GET') {
  mjl_api_fields($body, array());
  $data = mjl_api_reference_read($kind, $actor, $id, (int) ($request['query']['page'] ?? 1), $request['query']['partner_id'] ?? null);
  mjl_auth_session_touch(time());
  return array(200, $data);
 }
 if (!mjl_reference_can_manage($actor)) mjl_api_fail(403, 'forbidden');
 $creating = $id === null;
 $active = isset($parts[3]);
 $id = $creating ? '0' : $id;
 $operation = $creating ? 'create'.$config['operation'] : ($active ? 'set'.$config['operation'].'Active' : 'rename'.$config['operation']);
 $fields = $creating ? ($kind === 'project' ? array('label', 'partner_id') : array('label')) : ($active ? array('active', 'fingerprint') : array('label', 'fingerprint'));
 mjl_api_fields($body, $fields);
 if (!$creating) {
  mjl_api_string($body->fingerprint, 64);
  if (!preg_match('/^[a-f0-9]{64}$/D', $body->fingerprint)) mjl_api_fail(422, 'invalid_input');
  mjl_api_reference_read($kind, $actor, $id);
 }
 if ($active) {
  if (!is_bool($body->active)) mjl_api_fail(400, 'invalid_request');
 } else {
  mjl_api_string($body->label, 2048);
  $label = trim($body->label);
  if ($label === '' || mb_strlen($label) > 255 || preg_match('/[\x00-\x1F\x7F]/u', $label)) mjl_api_fail(422, 'invalid_input');
  if (class_exists('Normalizer')) $label = Normalizer::normalize($label, Normalizer::FORM_C);
 }
 $partnerId = $creating && $kind === 'project' ? mjl_api_id($body->partner_id) : '0';
 $token = $_SERVER['HTTP_X_MJL_SUBMISSION'] ?? '';
 if (!mjl_form_submission_consume($token, mjl_api_reference_context($kind, $operation, $id, $actor))) mjl_api_fail(403, 'submission_invalid');
 $command = new MjlReferenceCommand($db, $actor, mjl_auth_entity());
 try {
  if ($creating) {
   $result = $command->create($kind, $label, $partnerId);
   $id = (string) $result[0];
  } elseif ($active) $command->setActive($kind, $id, $body->active, $body->fingerprint);
  else $command->updateLabel($kind, $id, $label, $body->fingerprint);
 } catch (MjlReferenceCommandForbidden $e) {
  // The command records its finite denial outcome before throwing.
 }
 $code = $command->outcomeCode();
 if ($code !== 'OK') {
  $codes = array('INVALID_INPUT' => array(422, 'invalid_input'), 'INACTIVE_PARENT' => array(422, 'inactive_parent'), 'FORBIDDEN' => array(403, 'forbidden'), 'NOT_FOUND' => array(404, 'not_found'), 'STALE_FINGERPRINT' => array(409, 'stale_fingerprint'), 'OUTCOME_UNKNOWN' => array(503, 'outcome_unknown'));
  $mapped = $codes[$code] ?? array(503, 'unavailable');
  mjl_api_fail($mapped[0], $mapped[1]);
 }
 mjl_auth_session_touch(time());
 return array($creating ? 201 : 200, array('data' => array('code' => 'OK', 'id' => $id)));
}
