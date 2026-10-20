<?php
$escape=static function($value){return dol_escape_htmltag((string)$value);};
$hidden=static function(array $values)use($escape){foreach($values as $name=>$value)print '<input type="hidden" name="'.$escape($name).'" value="'.$escape($value).'">';};
$fields=static function(array $entry,$suffix)use($escape){
 print '<label for="label-'.$suffix.'">Libellé de la dépense</label><input id="label-'.$suffix.'" name="label" maxlength="255" required value="'.$escape($entry['label']??'').'">';
 print '<label for="date-'.$suffix.'">Date de la dépense</label><input id="date-'.$suffix.'" name="expense_date" type="date" required value="'.$escape($entry['expense_date']??'').'">';
 print '<label for="amount-'.$suffix.'">Montant (F CFA)</label><input id="amount-'.$suffix.'" name="amount" inputmode="numeric" pattern="[0-9]+" required value="'.$escape($entry['amount']??'').'">';
 print '<input type="hidden" name="original_id" value="'.$escape($entry['fk_original']??'').'">';
 if(!empty($entry['fk_original']))print '<label for="reason-'.$suffix.'">Motif de correction</label><textarea id="reason-'.$suffix.'" name="reason" maxlength="2000" required>'.$escape($entry['reason']??'').'</textarea>';
 else print '<input type="hidden" name="reason" value="">';
};
$labels=array('DRAFT'=>'Brouillon','SUBMITTED'=>'Soumise','APPROVED'=>'Approuvée','REJECTED'=>'Rejetée','WITHDRAWN'=>'Retirée');
$operation=$model['operation'];
?>
<div class="mjl-workspace">
<h1>Dépenses de l’Opération</h1>
<p><?= $escape($operation['name']) ?> — <?= $escape($operation['activity_ref']) ?></p>
<p><a href="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/operations.php">Retour aux Opérations</a></p>
<?php if($result!==''): ?><p role="status"><?= $result==='OK'?'Enregistrement effectué.':'Action non effectuée. Vérifiez vos droits, les données et leur version, puis rechargez la page.' ?></p><?php endif; ?>
<p><strong>Montant dépensé approuvé :</strong> <?= $escape(mjl_format_money($operation['spent_amount'])) ?></p>
<p>Les brouillons et dépenses soumises ne sont pas comptabilisés. Pour déclarer une absence de dépense, soumettez une écriture de montant zéro avec un libellé explicite.</p>
<?php if(isset($forms['create'])): ?>
<section class="mjl-operation-card"><h2>Nouvelle dépense</h2>
<form method="post" action="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/expenses.php">
<?php $hidden($forms['create']);$fields(array(),'new'); ?>
<button type="submit" class="button">Enregistrer le brouillon</button>
</form></section>
<?php endif; ?>
<?php foreach($model['entries'] as $entry): $id=$entry['rowid']; ?>
<article class="mjl-operation-card" data-expense-id="<?= (int)$id ?>">
<h2><?= $entry['kind']==='REVERSAL'?'Contrepassation — ':'' ?><?= $escape($entry['label']) ?></h2>
<p><strong><?= $escape($labels[$entry['status']]) ?></strong> · <?= $escape(mjl_format_date($entry['expense_date'])) ?> · <?= $escape(mjl_format_money($entry['amount'])) ?></p>
<?php if($entry['fk_original']!==null): ?><p>Écriture d’origine : #<?= (int)$entry['fk_original'] ?> — <?= $escape($entry['reason']) ?></p><?php endif; ?>
<?php if($entry['reversed']): ?><p>Cette écriture est conservée et compensée par une contrepassation.</p><?php endif; ?>
<?php if($entry['decision_reason']!==null): ?><p>Motif de décision : <?= $escape($entry['decision_reason']) ?></p><?php endif; ?>
<?php if(isset($forms[$id]['save'])): ?>
<form method="post" action="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/expenses.php">
<?php $hidden($forms[$id]['save']);$fields($entry,'edit-'.(int)$id); ?>
<button type="submit" class="button">Enregistrer les modifications</button></form>
<?php endif; ?>
<?php if(isset($forms[$id]['transition'])): ?>
<form method="post" action="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/expenses.php">
<?php $hidden($forms[$id]['transition']); ?>
<?php if($model['role']==='VALIDATEUR_DEFINITIF'): ?>
<label for="decision-reason-<?= (int)$id ?>">Motif de décision (obligatoire pour rejeter)</label><textarea id="decision-reason-<?= (int)$id ?>" name="reason" maxlength="2000"></textarea>
<button type="submit" name="decision" value="APPROVED" class="button">Approuver</button>
<button type="submit" name="decision" value="REJECTED" class="button">Rejeter</button>
<?php else: ?><input type="hidden" name="reason" value="">
<?php if($entry['status']==='DRAFT'): ?><button type="submit" name="decision" value="SUBMITTED" class="button">Soumettre</button><?php endif; ?>
<button type="submit" name="decision" value="WITHDRAWN" class="button">Retirer</button>
<?php endif; ?></form>
<?php endif; ?>
<?php if(isset($forms[$id]['correction'])): ?>
<details><summary>Demander une correction</summary>
<p>L’original reste effectif jusqu’à l’approbation de la contrepassation et du remplacement.</p>
<form method="post" action="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/expenses.php">
<?php $hidden($forms[$id]['correction']);$fields(array_merge($entry,array('fk_original'=>$id,'reason'=>'')),'correct-'.(int)$id); ?>
<button type="submit" class="button">Enregistrer la correction</button></form></details>
<?php endif; ?>
</article>
<?php endforeach; ?>
<nav aria-label="Pagination des dépenses">
<?php if($model['page']>1): ?><a href="?operation_id=<?= (int)$operation['rowid'] ?>&amp;page=<?= $model['page']-1 ?>">Page précédente</a><?php endif; ?>
<?php if($model['has_next']): ?><a href="?operation_id=<?= (int)$operation['rowid'] ?>&amp;page=<?= $model['page']+1 ?>">Page suivante</a><?php endif; ?>
</nav>
</div>
