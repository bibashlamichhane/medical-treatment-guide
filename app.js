/* =========================================================
   MEDICAL TREATMENT GUIDE
   Supabase + IndexedDB + PWA
   ========================================================= */

/* Put your Supabase anon/public key below.
   Project URL for project id cdqsuqndnqfgcmytostj:
   https://cdqsuqndnqfgcmytostj.supabase.co
*/
const SUPABASE_URL = 'https://cdqsuqndnqfgcmytostj.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DB_NAME='treatment-guide-offline';
const DB_VERSION=1;

let db;
let state={home:[], treatments:[], currentTreatment:null, adminTab:'home', session:null, slidesIndex:0, installPrompt:null};

const $=s=>document.querySelector(s);
const app=$('#app');

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function lines(v=''){return String(v).split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function nl(v=''){return escapeHtml(v).replace(/\n/g,'<br>')}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('data'))d.createObjectStore('data')};
    req.onsuccess=()=>{db=req.result;resolve(db)}; req.onerror=()=>reject(req.error);
  })
}
async function cacheSet(key,value){await openDB();return new Promise((res,rej)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function cacheGet(key){await openDB();return new Promise((res,rej)=>{const tx=db.transaction('data');const q=tx.objectStore('data').get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}

function offlineUI(){const off=!navigator.onLine;$('#offlineBar').classList.toggle('hidden',!off);return off}
window.addEventListener('online',()=>{offlineUI();syncFromSupabase()});
window.addEventListener('offline',()=>offlineUI());

async function syncFromSupabase(){
  if(!navigator.onLine || SUPABASE_ANON_KEY.startsWith('PASTE_')) return;
  $('#sync-status').textContent='Syncing...';
  try{
    const [{data:home,error:e1},{data:treatments,error:e2}]=await Promise.all([
      sb.from('home_sections').select('*').eq('published',true).order('sort_order',{ascending:true}),
      sb.from('treatments').select('*').eq('published',true).order('sort_order',{ascending:true})
    ]);
    if(e1) throw e1;if(e2) throw e2;
    state.home=home||[];state.treatments=treatments||[];
    await cacheSet('home',state.home);await cacheSet('treatments',state.treatments);await cacheSet('syncedAt',new Date().toISOString());
    $('#sync-status').textContent='Updated '+new Date().toLocaleTimeString();
    render();
  }catch(err){
    console.error(err);$('#sync-status').textContent='Using saved data';
    await loadCache();
  }
}
async function loadCache(){
  state.home=(await cacheGet('home'))||[];
  state.treatments=(await cacheGet('treatments'))||[];
  const s=await cacheGet('syncedAt');if(s)$('#sync-status').textContent='Saved '+new Date(s).toLocaleString();
}

function homeSections(type){return state.home.filter(x=>x.section_type===type)}
function renderHome(){
  const slides=homeSections('slide');
  const cards=homeSections('info');
  app.innerHTML=`
  <section class="hero"><div class="slider" id="slider">
    ${slides.length?slides.map((s,i)=>`<article class="slide ${i===state.slidesIndex?'active':''}"><div class="slide-content">
      <h1>${escapeHtml(s.title)}</h1><p>${nl(s.body||'')}</p>${s.button_text?`<a class="primary" href="${escapeHtml(s.button_url||'#treatments')}">${escapeHtml(s.button_text)}</a>`:''}
    </div></article>`).join(''):`<article class="slide active"><div class="slide-content"><h1>Medical Treatment Guide</h1><p>Add your home slides from the Admin panel.</p></div></article>`}
    ${slides.length>1?`<div class="dots">${slides.map((_,i)=>`<span class="dot ${i===state.slidesIndex?'active':''}"></span>`).join('')}</div><div class="slider-controls"><button onclick="prevSlide()">‹</button><button onclick="nextSlide()">›</button></div>`:''}
  </div></section>
  <section class="container"><div class="section-title"><h2>About this website</h2></div>
    <div class="info-grid">${cards.length?cards.map(c=>`<article class="card"><h3>${escapeHtml(c.title)}</h3><p>${nl(c.body||'')}</p></article>`).join(''):`<article class="card"><h3>Welcome</h3><p>Use Admin to add website information.</p></article>`}</div>
  </section>
  <section class="container" id="treatments"><div class="section-title"><h2>Treatment</h2><a class="btn" href="#treatments">View all</a></div>
    <div class="treatment-grid">${state.treatments.slice(0,6).map(treatmentCard).join('')||'<div class="card empty">No treatments available.</div>'}</div>
  </section>`;
  startSlider();
}
function treatmentCard(t){return `<article class="card treatment-card"><h3>${escapeHtml(t.disease_name_en)}</h3><div class="nepali">${escapeHtml(t.disease_name_ne||'')}</div><p class="muted">${escapeHtml((t.details||'').slice(0,150))}${(t.details||'').length>150?'…':''}</p><button class="btn see" onclick="openTreatment('${t.id}')">See treatment</button></article>`}
function renderTreatments(){
  app.innerHTML=`<section class="container"><div class="section-title"><h2>Treatment</h2></div>
  <input id="treatmentSearch" class="search" placeholder="Search disease in English or Nepali..." oninput="filterTreatments()">
  <div id="treatmentResults" class="treatment-grid">${state.treatments.map(treatmentCard).join('')||'<div class="card empty">No treatments available.</div>'}</div></section>`;
}
function filterTreatments(){
  const q=$('#treatmentSearch').value.toLowerCase();
  $('#treatmentResults').innerHTML=state.treatments.filter(t=>(t.disease_name_en+' '+(t.disease_name_ne||'')).toLowerCase().includes(q)).map(treatmentCard).join('')||'<div class="card empty">No matching disease.</div>';
}
window.openTreatment=id=>{state.currentTreatment=state.treatments.find(x=>x.id===id);location.hash='treatment/'+id}
function renderTreatment(){
  const t=state.currentTreatment;
  if(!t){location.hash='treatments';return}
  const images=(t.images||[]);
  app.innerHTML=`<section class="container"><a href="#treatments" class="btn">← Back</a><div class="detail" style="margin-top:15px">
    <h1>${escapeHtml(t.disease_name_en)}</h1><div class="nepali">${escapeHtml(t.disease_name_ne||'')}</div>
    ${images.map(x=>`<img src="${escapeHtml(x)}" alt="${escapeHtml(t.disease_name_en)}">`).join('')}
    <div class="columns">
      <div><h2>C.O / Chief Complaints</h2><ul class="list">${lines(t.chief_complaints).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>Not provided</li>'}</ul></div>
      <div><h2>Medicine</h2><ul class="list">${lines(t.medicines).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>Not provided</li>'}</ul></div>
    </div>
    <h2>Procedure of Treatment by Doctor</h2><ol class="list">${lines(t.procedure).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>Not provided</li>'}</ol>
    <h2>Detail of Disease</h2><div>${nl(t.details||'')}</div>
    ${t.notes?`<h2>Notes</h2><div>${nl(t.notes)}</div>`:''}
  </div></section>`;
}

function renderAdmin(){
  if(!state.session){renderLogin();return}
  const tab=state.adminTab;
  app.innerHTML=`<section class="container"><div class="admin-layout">
    <aside class="admin-menu">
      <button class="${tab==='home'?'active':''}" onclick="adminTab('home')">Home content</button>
      <button class="${tab==='treatments'?'active':''}" onclick="adminTab('treatments')">Treatments</button>
      <button class="${tab==='settings'?'active':''}" onclick="adminTab('settings')">Settings</button>
      <button onclick="logout()">Log out</button>
    </aside>
    <div class="admin-panel">${tab==='home'?adminHome():tab==='treatments'?adminTreatments():adminSettings()}</div>
  </div></section>`;
}
function renderLogin(){
  app.innerHTML=`<section class="container"><div class="card login"><h2>Admin Login</h2><div class="notice">Only authenticated Supabase users can access the admin panel.</div>
    <form onsubmit="login(event)"><div class="field"><label>Email</label><input id="loginEmail" type="email" required></div><div class="field"><label>Password</label><input id="loginPassword" type="password" required></div><button class="primary">Login</button></form>
  </div></section>`;
}
function adminHome(){
  return `<div class="card"><div class="row"><h2>Home content</h2><button class="primary" onclick="newHome()">+ Add section</button></div>
  <p class="muted">Create, edit, delete and reorder slides/info blocks shown on Home.</p>
  <table class="admin-table"><thead><tr><th>Order</th><th>Type</th><th>Title</th><th>Published</th><th>Actions</th></tr></thead><tbody>
  ${state.home.map(x=>`<tr><td>${x.sort_order}</td><td><span class="badge">${escapeHtml(x.section_type)}</span></td><td>${escapeHtml(x.title)}</td><td>${x.published?'Yes':'No'}</td><td><div class="actions"><button class="btn" onclick="editHome('${x.id}')">Edit</button><button class="btn danger" onclick="deleteHome('${x.id}')">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function adminTreatments(){
  return `<div class="card"><div class="row"><h2>Treatments</h2><button class="primary" onclick="newTreatment()">+ Add treatment</button></div>
  <table class="admin-table"><thead><tr><th>Order</th><th>Disease</th><th>Nepali</th><th>Published</th><th>Actions</th></tr></thead><tbody>
  ${state.treatments.map(x=>`<tr><td>${x.sort_order}</td><td>${escapeHtml(x.disease_name_en)}</td><td>${escapeHtml(x.disease_name_ne||'')}</td><td>${x.published?'Yes':'No'}</td><td><div class="actions"><button class="btn" onclick="editTreatment('${x.id}')">Edit</button><button class="btn danger" onclick="deleteTreatment('${x.id}')">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function adminSettings(){return `<div class="card"><h2>Settings</h2><p>Supabase project: <b>${escapeHtml(SUPABASE_URL)}</b></p><p>Offline database: IndexedDB</p><p>PWA: Service Worker + Web App Manifest</p><p class="muted">Data syncs from Supabase whenever the device reconnects.</p></div>`}

function modal(html){const d=document.createElement('div');d.className='modal-backdrop';d.id='modal';d.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(d)}
function closeModal(){$('#modal')?.remove()}

function homeForm(x={section_type:'slide',title:'',body:'',button_text:'',button_url:'#treatments',sort_order:0,published:true}){
 return `<h2>${x.id?'Edit':'Add'} Home Section</h2><form onsubmit="saveHome(event,'${x.id||''}')">
 <div class="field"><label>Section type</label><select id="hfType"><option value="slide" ${x.section_type==='slide'?'selected':''}>Slide</option><option value="info" ${x.section_type==='info'?'selected':''}>Info</option></select></div>
 <div class="field"><label>Title</label><input id="hfTitle" value="${escapeHtml(x.title)}" required></div><div class="field"><label>Text</label><textarea id="hfBody">${escapeHtml(x.body||'')}</textarea></div>
 <div class="field"><label>Button text</label><input id="hfButton" value="${escapeHtml(x.button_text||'')}"></div><div class="field"><label>Button URL</label><input id="hfUrl" value="${escapeHtml(x.button_url||'#treatments')}"></div>
 <div class="field"><label>Sort order</label><input id="hfOrder" type="number" value="${x.sort_order||0}"></div>
 <div class="field"><label><input id="hfPublished" type="checkbox" ${x.published!==false?'checked':''}> Published</label></div>
 <div class="actions"><button class="primary">Save</button><button type="button" class="btn" onclick="closeModal()">Cancel</button></div></form>`;
}
window.newHome=()=>modal(homeForm());window.editHome=id=>modal(homeForm(state.home.find(x=>x.id===id)));
window.saveHome=async(e,id)=>{e.preventDefault();const payload={section_type:$('#hfType').value,title:$('#hfTitle').value,body:$('#hfBody').value,button_text:$('#hfButton').value,button_url:$('#hfUrl').value,sort_order:Number($('#hfOrder').value)||0,published:$('#hfPublished').checked};await saveTable('home_sections',id,payload);closeModal();await syncFromSupabase();renderAdmin()}
window.deleteHome=async id=>{if(confirm('Delete this Home section?')){await sb.from('home_sections').delete().eq('id',id);await syncFromSupabase();renderAdmin()}}

function treatmentForm(x={disease_name_en:'',disease_name_ne:'',chief_complaints:'',medicines:'',procedure:'',details:'',notes:'',images:[],sort_order:0,published:true}){
 return `<h2>${x.id?'Edit':'Add'} Treatment</h2><form onsubmit="saveTreatment(event,'${x.id||''}')">
 <div class="columns"><div class="field"><label>Disease name (English)</label><input id="tfEn" value="${escapeHtml(x.disease_name_en)}" required></div><div class="field"><label>Disease name (Nepali)</label><input id="tfNe" value="${escapeHtml(x.disease_name_ne||'')}"></div></div>
 <div class="field"><label>C.O / Chief complaints — one point per line</label><textarea id="tfCO">${escapeHtml(x.chief_complaints||'')}</textarea></div>
 <div class="field"><label>Medicine name — one point per line</label><textarea id="tfMed">${escapeHtml(x.medicines||'')}</textarea></div>
 <div class="field"><label>Procedure of treatment by doctor — one point per line</label><textarea id="tfProc">${escapeHtml(x.procedure||'')}</textarea></div>
 <div class="field"><label>Detail of disease</label><textarea id="tfDetails">${escapeHtml(x.details||'')}</textarea></div>
 <div class="field"><label>Additional notes</label><textarea id="tfNotes">${escapeHtml(x.notes||'')}</textarea></div>
 <div class="field"><label>Image URLs — one URL per line</label><textarea id="tfImages">${escapeHtml((x.images||[]).join('\\n'))}</textarea></div>
 <div class="field"><label>Sort order</label><input id="tfOrder" type="number" value="${x.sort_order||0}"></div>
 <div class="field"><label><input id="tfPublished" type="checkbox" ${x.published!==false?'checked':''}> Published</label></div>
 <div class="actions"><button class="primary">Save</button><button type="button" class="btn" onclick="closeModal()">Cancel</button></div></form>`;
}
window.newTreatment=()=>modal(treatmentForm());window.editTreatment=id=>modal(treatmentForm(state.treatments.find(x=>x.id===id)));
window.saveTreatment=async(e,id)=>{e.preventDefault();const payload={disease_name_en:$('#tfEn').value,disease_name_ne:$('#tfNe').value,chief_complaints:$('#tfCO').value,medicines:$('#tfMed').value,procedure:$('#tfProc').value,details:$('#tfDetails').value,notes:$('#tfNotes').value,images:lines($('#tfImages').value),sort_order:Number($('#tfOrder').value)||0,published:$('#tfPublished').checked};await saveTable('treatments',id,payload);closeModal();await syncFromSupabase();renderAdmin()}
window.deleteTreatment=async id=>{if(confirm('Delete this treatment?')){await sb.from('treatments').delete().eq('id',id);await syncFromSupabase();renderAdmin()}}

async function saveTable(table,id,payload){if(SUPABASE_ANON_KEY.startsWith('PASTE_')){toast('Add your Supabase anon key first.');return}let q=id?sb.from(table).update(payload).eq('id',id):sb.from(table).insert(payload);const {error}=await q;if(error){toast(error.message);throw error}toast('Saved successfully')}
window.adminTab=tab=>{state.adminTab=tab;renderAdmin()}
window.login=async e=>{e.preventDefault();if(SUPABASE_ANON_KEY.startsWith('PASTE_')){toast('Add your Supabase anon key in app.js first.');return}const {data,error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value,password:$('#loginPassword').value});if(error)return toast(error.message);state.session=data.session;location.hash='admin'}
window.logout=async()=>{await sb.auth.signOut();state.session=null;location.hash='home';render()}
sb.auth.onAuthStateChange((_event,session)=>{state.session=session;if(location.hash==='#admin'||location.hash.startsWith('#admin/'))renderAdmin()})

function startSlider(){if(state.sliderTimer)clearInterval(state.sliderTimer);if(state.home.filter(x=>x.section_type==='slide').length>1)state.sliderTimer=setInterval(()=>nextSlide(true),5000)}
window.nextSlide=(auto=false)=>{const n=homeSections('slide').length;if(n<2)return;state.slidesIndex=(state.slidesIndex+1)%n;if(location.hash==='#home'||location.hash==='')renderHome()}
window.prevSlide=()=>{const n=homeSections('slide').length;if(n<2)return;state.slidesIndex=(state.slidesIndex-1+n)%n;renderHome()}

function render(){
 offlineUI();
 const h=location.hash||'#home';
 if(h==='#home'||h==='#'){renderHome()}
 else if(h==='#treatments'){renderTreatments()}
 else if(h.startsWith('#treatment/')){const id=h.split('/')[1];state.currentTreatment=state.treatments.find(x=>x.id===id);renderTreatment()}
 else if(h==='#admin'){renderAdmin()}
 else {location.hash='home'}
}
window.addEventListener('hashchange',render);

async function init(){
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(console.error);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installBtn').classList.remove('hidden')});
  $('#installBtn').onclick=async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('#installBtn').classList.add('hidden')};
  await loadCache();render();
  if(navigator.onLine)await syncFromSupabase();
}
init();
