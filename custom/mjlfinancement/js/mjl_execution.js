(function () {
 'use strict';
 async function init() {
  const app=document.getElementById('mjl-execution-app');if(!app)return;
  app.querySelector('[data-mjl-js-required]').remove();app.querySelector('[data-loading]').hidden=false;
  const base=app.dataset.base,screen=app.dataset.screen,query=new URLSearchParams(location.search);
  ['mainmenu','leftmenu','result'].forEach(key=>query.delete(key));
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>value===null||value===undefined?'Non renseigné':BigInt(value).toLocaleString('fr-FR')+' F CFA';
  const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleString('fr-FR',{timeZone:'Africa/Porto-Novo',day:'2-digit',month:'2-digit',year:'numeric',...(value.length===10?{}:{hour:'2-digit',minute:'2-digit'})}):'Non renseigné';
  const labels={DRAFT:'Brouillon',SUBMITTED:'Soumise',APPROVED:'Approuvée',REJECTED:'Rejetée',WITHDRAWN:'Retirée',PENDING:'En attente',TODO:'À faire',IN_PROGRESS:'En cours',COMPLETED:'Terminée',CANCELLED:'Annulée',FINAL_VALIDATED:'Validée définitivement',PREVALIDATED:'Prévalidée',RETURNED_SUPERVISOR:'Retournée par le superviseur',RETURNED_VALIDATOR:'Retournée par le validateur',ABANDONED:'Abandonnée',NOT_STARTED:'Non commencée',UPCOMING:'À venir',OVERDUE:'En retard',PARTIAL:'Partielle',COMPLETE:'Complète',CANCELLATION:'Annulation',REOPENING:'Réouverture'};
  const badge=status=>`<span class="mjl-status-pill mjl-status-${['APPROVED','COMPLETED'].includes(status)?'success':'neutral'}">${escape(labels[status]||status)}</span>`;
  const link=(label,url)=>`<a class="mjl-action mjl-action-secondary" href="${escape(url)}">${escape(label)}</a>`;
  const field=(label,name,value='',attrs='')=>`<label>${label}<input name="${name}" value="${escape(value)}" ${attrs}></label>`;
  const reason=(label='Motif',required=true,value='')=>`<label>${label}<textarea name="reason" maxlength="2000" ${required?'required':''}>${escape(value)}</textarea></label>`;
  const form=(key,contents,buttons)=>`<form class="mjl-exception-form" data-form="${key}" data-mjl-substantive data-mjl-api-form>${contents}<div class="mjl-dialog-actions">${buttons}</div></form>`;
  const button=(label,value='')=>`<button class="button" type="submit" ${value?`value="${value}"`:''}>${label}</button>`;
  const meta=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
  function header(title,description=''){app.innerHTML=`<header class="mjl-page-header"><div class="mjl-page-header-layout"><div class="mjl-page-header-content"><h1>${title}</h1><p>${description}</p></div></div></header><p role="status" data-result></p>`;if(new URLSearchParams(location.search).get('result')==='OK')app.querySelector('[data-result]').textContent='Enregistrement effectué.';}
  function error(message,host=app){let node=host.querySelector('[data-api-error]');if(!node){node=document.createElement('p');node.dataset.apiError='';node.setAttribute('role','alert');node.tabIndex=-1;host.prepend(node);}node.textContent=message;node.focus();}
  function activate(){window.MjlUi?.init(app);window.mjlInitActivityComponents?.(app);}
  function bind(key,operation,path,parameters,version,body,method='POST'){
   const node=app.querySelector(`[data-form="${key}"]`);if(!node)return;
   node.addEventListener('submit',async event=>{
    if(event.defaultPrevented)return;event.preventDefault();if(!node.reportValidity()||node.dataset.sending)return;
    const input=body(new FormData(node),event);node.dataset.sending='1';const buttons=Array.from(node.querySelectorAll('button[type=submit]'));buttons.forEach(b=>b.disabled=true);let uncertain=false;
    try{
     const token=await mjlApi.request('/submission-tokens','POST',{operation_id:operation,path_parameters:parameters,expected_version:version});
     await mjlApi.request(path,method,{expected_version:version,...input},token.data.token);
     node.dispatchEvent(new Event('mjl:api-saved'));const url=new URL(location.href);url.searchParams.set('result','OK');location.assign(url.href);
    }catch(e){error(e.message,node);uncertain=e.code==='outcome_unknown';if(uncertain){const a=document.createElement('a');a.href=location.href;a.textContent='Consulter la fiche';node.append(a);}}
    finally{if(!uncertain){delete node.dataset.sending;buttons.forEach(b=>b.disabled=false);}}
   });
  }
  function pagination(p){if(p.page===1&&!p.has_next)return;const url=new URL(location.href);app.insertAdjacentHTML('beforeend','<nav class="mjl-pagination" aria-label="Pagination" data-pagination></nav>');const nav=app.querySelector('[data-pagination]');for(const [label,n,rel] of [['Page précédente',p.page-1,'prev'],['Page suivante',p.page+1,'next']])if((rel==='prev'&&p.page>1)||(rel==='next'&&p.has_next)){url.searchParams.set('page',n);url.searchParams.delete('result');nav.insertAdjacentHTML('beforeend',`<a rel="${rel}" href="${escape(url.href)}">${label}</a>`);}}
  function dialog(key,title,guidance,contents){return `<a class="mjl-action mjl-action-secondary" href="#${key}" data-mjl-dialog-open="${key}">${title}</a><dialog id="${key}" class="mjl-modal-dialog mjl-exception-dialog" aria-labelledby="${key}-title" data-mjl-dialog><div class="mjl-dialog-panel"><div class="mjl-section-heading"><h2 id="${key}-title">${title}</h2><button type="button" class="mjl-action mjl-action-secondary" data-mjl-dialog-close>Fermer</button></div><p>${guidance}</p>${contents}</div></dialog>`;}
  async function filters(kind){
   const choices=(await mjlApi.request('/monitoring-options')).data;
   const select=(label,name,rows)=>`<label>${label}<select name="${name}"><option value="">Tous</option>${query.get(name)&&!rows.some(r=>r.id===query.get(name))?`<option value="${escape(query.get(name))}" selected>Référence hors sélection</option>`:''}${rows.map(r=>`<option value="${escape(r.id)}" ${query.get(name)===r.id?'selected':''}>${escape(r.label)}</option>`).join('')}</select></label>`;
   const states=keys=>keys.map(id=>({id,label:labels[id]}));
   let html=field('Rechercher','q',query.get('q')||'','maxlength="100"');
   html+=select('Partenaire','partner_id',choices.partner_id)+select('Projet','project_id',choices.project_id);
   if(query.has('activity_id'))html+=`<input type="hidden" name="activity_id" value="${escape(query.get('activity_id'))}">`;
   html+=select('Validation','validation_status',states(['DRAFT','SUBMITTED','PREVALIDATED','RETURNED_SUPERVISOR','RETURNED_VALIDATOR','FINAL_VALIDATED','ABANDONED','CANCELLED']));
   html+=select('Exécution de l’Activité','execution_status',states(['NOT_STARTED','UPCOMING','IN_PROGRESS','OVERDUE','COMPLETED','CANCELLED']));
   html+=select('Complétude financière','completeness',[{id:'NOT_STARTED',label:'Non renseignée'},...states(['PARTIAL','COMPLETE'])]);
   html+=field('Du','date_from',query.get('date_from')||'','type="date"')+field('Au','date_to',query.get('date_to')||'','type="date"');
   if(kind==='operations')html+=select('Type d’Opération','type_id',choices.type_id)+select('État de l’Opération','operation_status',states(['TODO','IN_PROGRESS','COMPLETED','CANCELLED']));
   else{html+=select('Type de demande','type',states(['CANCELLATION','REOPENING']));if(!query.has('status'))query.set('status','PENDING');html+=select('Statut de la demande','status',states(['PENDING','APPROVED','REJECTED','WITHDRAWN']));if(query.has('request_id'))html+=`<input type="hidden" name="request_id" value="${escape(query.get('request_id'))}">`;}
   app.insertAdjacentHTML('beforeend',`<details class="mjl-workspace-section"><summary>Filtrer la sélection</summary><form method="GET" class="mjl-activity-form">${html}<button class="button" type="submit">Filtrer</button>${link('Réinitialiser',base+(kind==='operations'?'/operations.php':'/operationrequests.php'))}</form></details><p>La période retient les Activités dont les dates chevauchent les dates choisies. Périmètre : vos accès courants.</p>`);
  }
  async function operations(){
   header('Opérations','Saisir et suivre l’exécution des Opérations.');await filters('operations');
   const result=await mjlApi.request('/operations?'+query.toString());
   app.insertAdjacentHTML('beforeend',`<p>Les filtres de type et d’état d’Opération ne changent pas les totaux de l’Activité parente.</p>${link('Suivi des Opérations et téléchargements',base+'/reports.php?report=operations&'+query.toString())}`);
   if(!result.data.length)app.insertAdjacentHTML('beforeend','<p>Aucune Opération ne correspond aux filtres et à vos accès.</p>');
   for(const row of result.data){
    const id=row.id,actions=row.allowed_actions,params={operation_id:id},path='/operations/'+id;
    const diff=row.spent_amount===null?null:BigInt(row.spent_amount)-BigInt(row.authorized_amount);const den=BigInt(row.authorized_amount),abs=diff===null?0n:diff<0n?-diff:diff,percent=den===0n||diff===null?null:(abs*10000n+den/2n)/den;
    let contents=`<h2>${escape(row.name)}</h2><p>${link(row.activity_ref+' — '+row.activity_name,base+'/activities.php?id='+row.activity_id)}</p><dl class="mjl-activity-meta">${meta('Partenaire',escape(row.partner_label))}${meta('Projet',escape(row.project_label))}${meta('Type d’Opération',escape(row.type_label))}${meta('Statut',badge(row.status))}${meta(row.authorization_kind==='PROPOSED'?'Montant proposé':'Montant autorisé validé',money(row.authorized_amount))}${meta('Montant dépensé',money(row.spent_amount))}${meta('Écart',money(diff))}${meta('Variance %',percent===null?'Non renseigné':(diff<0n?'-':'')+(percent/100n)+','+String(percent%100n).padStart(2,'0')+' %')}</dl>`;
    if(row.observation)contents+=`<p><strong>Observation :</strong> ${escape(row.observation)}</p>`;
    contents+=`<p>${link('Dépenses et approbations',base+'/expenses.php?operation_id='+id)}</p>`;
    if(actions.includes('updateExecution'))contents+=form('execution-'+id,`<label>Statut<select name="status">${['TODO','IN_PROGRESS','COMPLETED'].map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${labels[s]}</option>`).join('')}</select></label><label>Observation<textarea name="observation" maxlength="2000">${escape(row.observation)}</textarea></label>`,button('Enregistrer l’exécution'));
    for(const [operation,suffix,label,guidance] of [['requestOperationCancellation','cancellation-requests','Demander l’annulation','Les montants restent conservés. Une Opération annulée ne peut pas être rouverte.'],['requestOperationReopening','reopening-requests','Demander la réouverture','Après approbation, l’Opération revient à « En cours » avec ses montants conservés.']])if(actions.includes(operation))contents+=dialog('dialog-'+operation+id,label,guidance,form(operation+id,reason('Motif de la demande'),button(label)));
    if(row.status==='COMPLETED')contents+='<p>Cette Opération est terminée et verrouillée. Une demande approuvée est requise pour la rouvrir.</p>';
    if(row.status==='CANCELLED')contents+='<p>Cette Opération est annulée et verrouillée.</p>';
    contents+=`<p>${link('Voir les demandes d’exception',base+'/operationrequests.php')}</p>`;
    app.insertAdjacentHTML('beforeend',`<article class="mjl-operation-card" id="operation-${id}">${contents}</article>`);
    bind('execution-'+id,'updateExecution',path+'/execution',params,row.version,f=>({status:f.get('status'),observation:f.get('observation')||null}),'PUT');
    for(const [operation,suffix] of [['requestOperationCancellation','cancellation-requests'],['requestOperationReopening','reopening-requests']])bind(operation+id,operation,path+'/'+suffix,params,row.version,f=>({reason:f.get('reason')}));
   }
   pagination(result.pagination);activate();
  }
  async function requests(){
   header('Demandes d’exception','Annulations et réouvertures liées à une version précise.');await filters('requests');const result=await mjlApi.request('/exception-requests?'+query.toString());
   if(!result.data.length)app.insertAdjacentHTML('beforeend','<p>Aucune demande ne correspond aux filtres et à vos accès.</p>');
   for(const row of result.data){
    const key=row.type+row.id,path=(row.type==='CANCELLATION'?'/cancellation-requests/':'/reopening-requests/')+row.id,params={request_id:row.id};
    let contents=`<header class="mjl-section-heading"><div><p class="mjl-eyebrow">${labels[row.type]}</p><h2>${escape(row.target_label)}</h2></div>${badge(row.status)}</header><dl class="mjl-activity-meta">${meta('Version ciblée',row.target_version)}${meta('Version actuelle de la cible',row.current_target_version||'Indisponible')}${meta('Version de la demande',row.version)}${meta('Demandée par',escape(row.requester_name))}${meta('Date de demande',date(row.requested_at))}</dl><p><strong>Motif de la demande :</strong> ${escape(row.reason)}</p>`;
    if(row.decision_reason)contents+=`<p>Motif de décision : ${escape(row.decision_reason)}</p>`;
    if(row.stale)contents+='<p role="status">À clôturer : la cible a changé. La demande peut être rejetée ou retirée par les profils autorisés.</p>';
    if(row.allowed_actions.some(a=>a.startsWith('withdraw')))contents+=dialog('withdraw-'+key,'Retirer la demande','La demande sera clôturée sans modifier sa cible.',form('withdraw-'+key,'',button('Retirer la demande')));
    for(const decision of row.allowed_decisions){const label=decision==='APPROVED'?'Approuver':'Rejeter';contents+=dialog(decision+key,label+' la demande',decision==='APPROVED'?'La décision modifie le statut de la cible et conserve ses montants.':'Le rejet clôture la demande sans modifier sa cible.',form(decision+key,reason('Motif de décision'),button(label)));}
    app.insertAdjacentHTML('beforeend',`<article class="mjl-operation-card mjl-exception-card" data-request="${key}">${contents}</article>`);
    bind('withdraw-'+key,row.type==='CANCELLATION'?'withdrawCancellation':'withdrawReopening',path+'/withdrawal',params,row.version,()=>({}));
    for(const decision of row.allowed_decisions)bind(decision+key,row.type==='CANCELLATION'?'decideCancellation':'decideReopening',path+'/decisions',params,row.version,f=>({decision,reason:f.get('reason')}));
   }
   pagination(result.pagination);activate();
  }
  function expenseFields(entry={}){
   return field('Libellé de la dépense','label',entry.label||'','maxlength="255" required')+field('Date de la dépense','expense_date',entry.expense_date||'','type="date" required')+field('Montant (F CFA)','amount',entry.amount??'','inputmode="numeric" pattern="[0-9]+" required')+(entry.original_id?reason('Motif de correction',true,entry.reason||''):'');
  }
  async function expenses(){
   const id=query.get('operation_id');
   if(!id){header('Dépenses','Consultez les dépenses de chaque Opération. Les accès conservés après annulation sont limités aux corrections comptables.');const result=await mjlApi.request('/spending-operations?'+query.toString());if(!result.data.length)app.insertAdjacentHTML('beforeend','<p>Aucune Opération accessible.</p>');for(const row of result.data)app.insertAdjacentHTML('beforeend',`<article class="mjl-operation-card"><h2>${link(row.name,base+'/expenses.php?operation_id='+row.id)}</h2><p>${escape(row.activity_ref)}${row.correction_only?' — Accès aux corrections uniquement':''}</p><p>Montant dépensé approuvé : ${money(row.spent_amount)}</p></article>`);pagination(result.pagination);return;}
   const parameters=new URLSearchParams(query);parameters.delete('operation_id');const path='/operations/'+encodeURIComponent(id)+'/expenses';const model=(await mjlApi.request(path+'?'+parameters.toString())).data,o=model.operation;
   header('Dépenses de l’Opération',escape(o.name)+' — '+escape(o.activity_ref));app.insertAdjacentHTML('beforeend',`<p>${link('Retour aux Opérations',base+'/operations.php')}</p><p><strong>Montant dépensé approuvé :</strong> ${money(o.spent_amount)}</p><p>Les brouillons et dépenses soumises ne sont pas comptabilisés. Pour déclarer une absence de dépense, soumettez une écriture de montant zéro avec un libellé explicite.</p>${model.correction_only?'<p>Accès limité aux corrections comptables après annulation.</p>':''}`);
   const save=(key,entry,create)=>bind(key,create?'createExpense':'replaceExpenseDraft',create?path:path+'/'+entry.id,{operation_id:id,...(create?{}:{expense_id:entry.id})},create?o.version:entry.version,f=>({label:f.get('label'),expense_date:f.get('expense_date'),amount:f.get('amount'),original_id:entry.original_id||null,reason:f.get('reason')||null}),create?'POST':'PUT');
   if(model.allowed_actions.includes('createExpense')){app.insertAdjacentHTML('beforeend',`<section class="mjl-operation-card"><h2>Nouvelle dépense</h2>${form('new',expenseFields(),button('Enregistrer le brouillon'))}</section>`);save('new',{},true);}
   for(const entry of model.entries){
    let html=`<h2>${entry.kind==='REVERSAL'?'Contrepassation — ':''}${escape(entry.label)}</h2><p>${badge(entry.status)} · ${date(entry.expense_date)} · ${money(entry.amount)}</p>`;
    if(entry.original_id)html+=`<p>Écriture d’origine : #${entry.original_id} — ${escape(entry.reason)}</p>`;
    if(entry.reversed)html+='<p>Cette écriture est conservée et compensée par une contrepassation.</p>';
    if(entry.decision_reason)html+=`<p>Motif de décision : ${escape(entry.decision_reason)}</p>`;
    if(entry.allowed_actions.includes('replaceExpenseDraft'))html+=form('edit-'+entry.id,expenseFields(entry),button('Enregistrer les modifications'));
    for(const [action,label] of [['submitExpense','Soumettre'],['withdrawExpense','Retirer']])if(entry.allowed_actions.includes(action))html+=form(action+entry.id,'',button(label));
    if(entry.allowed_actions.includes('decideExpense'))html+=form('decide-'+entry.id,reason('Motif de décision (obligatoire pour rejeter)',false),entry.allowed_decisions.map(d=>button(d==='APPROVED'?'Approuver':'Rejeter',d)).join(''));
    if(entry.allowed_actions.includes('createExpense'))html+=`<details><summary>Demander une correction</summary><p>L’original reste effectif jusqu’à l’approbation de la contrepassation et du remplacement.</p>${form('correct-'+entry.id,expenseFields({...entry,original_id:entry.id,reason:''}),button('Enregistrer la correction'))}</details>`;
    app.insertAdjacentHTML('beforeend',`<article class="mjl-operation-card" data-expense-id="${entry.id}">${html}</article>`);
    save('edit-'+entry.id,entry,false);save('correct-'+entry.id,{...entry,original_id:entry.id},true);
    for(const [action,suffix] of [['submitExpense','submission'],['withdrawExpense','withdrawal']])bind(action+entry.id,action,path+'/'+entry.id+'/'+suffix,{operation_id:id,expense_id:entry.id},entry.version,()=>({}));
    bind('decide-'+entry.id,'decideExpense',path+'/'+entry.id+'/decisions',{operation_id:id,expense_id:entry.id},entry.version,(f,e)=>({decision:e.submitter.value,...(f.get('reason')?{reason:f.get('reason')}:{})}));
   }
   pagination(model.pagination);activate();
  }
  try{if(screen==='operations')await operations();else if(screen==='requests')await requests();else await expenses();}
  catch(e){app.querySelector('[data-loading]')?.remove();error(e.message);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}());
