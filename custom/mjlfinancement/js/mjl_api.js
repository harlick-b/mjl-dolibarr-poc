/* Same-origin REST transport. Credentials and security tokens remain in memory. */
(function () {
 'use strict';
 const script = document.currentScript;
 const base = new URL('../api/index.php/v1', script.src).pathname;
 let csrf = '';
 async function request(path, method = 'GET', body, submission) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
   if (!csrf) await request('/auth/session');
   headers['X-CSRF-Token'] = csrf;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (submission) headers['X-MJL-Submission'] = submission;
  let response, value;
  try {
   response = await fetch(base + path, { method, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error', body: body === undefined ? undefined : JSON.stringify(body) });
   value = response.status === 204 ? null : await response.json();
  } catch (_) {
   const error = new Error('La réponse n’a pas été reçue. Vérifiez le résultat avant toute nouvelle tentative.');
   error.code = 'outcome_unknown'; throw error;
  }
  if (value?.data?.csrf_token) csrf = value.data.csrf_token;
  if (!response.ok) {
   const error = new Error(value?.error?.message || 'Le service est temporairement indisponible.');
   error.code = value?.error?.code; error.status = response.status;
   if (response.status === 401 || error.code === 'csrf_invalid') csrf = '';
   throw error;
  }
  return value;
 }
 window.mjlApi = { request };
 document.querySelectorAll('[data-mjl-api-logout]').forEach(button => {
  if (button.dataset.bound) return;
  button.dataset.bound='1';
  button.addEventListener('click', () => {
   async function logout() {
    button.disabled=true;
    try { await request('/auth/session','DELETE'); location.assign(base.replace('/custom/mjlfinancement/api/index.php/v1','')+'/index.php'); }
    catch(e) { button.disabled=false; let error=document.querySelector('[data-logout-error]'); if(!error){error=document.createElement('p');error.dataset.logoutError='';error.setAttribute('role','alert');button.after(error);}error.textContent=e.message; }
   }
   const forms=Array.from(document.querySelectorAll('form[data-mjl-substantive]'));
   function confirmLeave(index) {
    if(index===forms.length) { logout(); return; }
    const event=new CustomEvent('mjl:request-leave',{cancelable:true,detail:{restoreTarget:button,leave:()=>confirmLeave(index+1)}});
    if(forms[index].dispatchEvent(event))confirmLeave(index+1);
   }
   confirmLeave(0);
  });
 });
}());
