<div class="mjl-workspace">
<h1>Dépenses</h1>
<p>Consultez et soumettez les dépenses de chaque Opération. Les accès conservés après annulation sont limités aux corrections comptables.</p>
<?php if(!$list['rows']): ?><p>Aucune Opération accessible.</p><?php endif; ?>
<?php foreach($list['rows'] as $row): ?>
<article class="mjl-operation-card">
<h2><a href="<?= DOL_URL_ROOT ?>/custom/mjlfinancement/expenses.php?operation_id=<?= (int)$row['rowid'] ?>"><?= dol_escape_htmltag($row['name']) ?></a></h2>
<p><?= dol_escape_htmltag($row['ref']) ?><?= $row['is_cancelled']?' — Activité annulée':'' ?></p>
<p>Montant dépensé approuvé : <?= dol_escape_htmltag(mjl_format_money($row['spent_amount'])) ?></p>
</article>
<?php endforeach; ?>
<nav aria-label="Pagination des Opérations">
<?php if($list['page']>1): ?><a href="?page=<?= $list['page']-1 ?>">Page précédente</a><?php endif; ?>
<?php if($list['has_next']): ?><a href="?page=<?= $list['page']+1 ?>">Page suivante</a><?php endif; ?>
</nav>
</div>
