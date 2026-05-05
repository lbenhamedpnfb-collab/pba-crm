// ════════════════════════════════════════════════════════════════ PBA CRM 2026
// Groupe DEFIS — Beauté & Esthétique — POEI + Alternance

const STAGES = ['Prospect','Contacted','Meeting','Proposal','Negotiation','Signed'];
const STAGE_LABELS = {Prospect:'Prospect',Contacted:'Contacté',Meeting:'RDV Prévu',Proposal:'Proposition',Negotiation:'Négociation',Signed:'Signé ✓'};
const KB_COLORS = {Prospect:'#78909C',Contacted:'#1A73E8',Meeting:'#9B2D8E',Proposal:'#F5A623',Negotiation:'#C2185B',Signed:'#0F9D58'};
const PROB = {Prospect:.05,Contacted:.15,Meeting:.35,Proposal:.60,Negotiation:.80,Signed:1.0};
const SECTOR_COLORS = {
  '💇 Coiffure':'#C2185B','💅 Esthétique/Soins':'#9B2D8E','🧖 Spa/Bien-être':'#0F9D58',
  '💋 Maquillage pro':'#E91E63','🛍️ Retail Beauté':'#1A73E8','💊 Cosmétique/Pharma':'#F5A623',
  '🤝 Partenaire':'#78909C'
};
const VIEW_TITLES = {
  mission:'Mission Control',kanban:'Pipeline Kanban',sequences:'Séquences Prospection',
  growth:'Growth Dashboard',pipeline:'Pipeline Commercial',partners:'Partenaires & OPCO',
  strategic:'Comptes Stratégiques','poei-view':'Contacts POEI','alt-view':'Contacts Alternance',
  'all-contacts':'Tous les Contacts',templates:'Templates Email',scripts:'Scripts Appels',
  metrics:'Métriques & KPIs',settings:'Paramètres & Équipe','email-suivi':'Suivi Emails & Relances'
};
const SEQUENCES = {
  poei_beaute:{name:'POEI Beauté Standard',tag:'POEI',steps:[
    {day:0,icon:'📧',label:'Email présentation POEI Beauté'},
    {day:7,icon:'📞',label:'Appel de relance RH/DRH'},
    {day:14,icon:'📧',label:'Email résultats + témoignages'},
    {day:21,icon:'🤝',label:'RDV présentation PBA'},
  ]},
  alternance_beaute:{name:'Alternance Esthétique',tag:'Alternance',steps:[
    {day:0,icon:'📧',label:'Email offre alternance CAP/BP/BTS'},
    {day:5,icon:'📞',label:'Appel responsable recrutement'},
    {day:10,icon:'📧',label:'Envoi plaquette formations + OPCO'},
    {day:20,icon:'🤝',label:'RDV visite école / portes ouvertes'},
  ]},
  grands_groupes:{name:'Grands Groupes Beauté',tag:'Strategic',steps:[
    {day:0,icon:'📧',label:'Email DRH personnalisé'},
    {day:7,icon:'📞',label:'Appel DRH / Responsable Formation'},
    {day:14,icon:'🤝',label:'RDV siège ou Teams'},
    {day:30,icon:'📝',label:'Convention cadre POEI + Alternance'},
  ]},
  partenaires_opco:{name:'Partenaires & OPCO',tag:'Partenaire',steps:[
    {day:0,icon:'📧',label:'Email présentation PBA/DEFIS'},
    {day:10,icon:'📞',label:'Appel conseiller OPCO'},
    {day:20,icon:'🤝',label:'Réunion partenariat'},
    {day:35,icon:'📝',label:'Convention signée'},
  ]},
};

const G = {
  contacts:[],view:'mission',sector:null,q:'',
  filters:{seg:'',type:'',stage:''},sf:'score',sd:-1,
  selId:null,_goals:null,_strat:null,
};
let ALL_TEMPLATES=[], ALL_SCRIPTS=[];
let _kbDragId=null, _emailFilter='all', G_emailContactId=null;

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiFetch(url,opts={}){
  try{
    const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json'},...opts});
    if(r.status===401){window.location='/login';return null;}
    if(!r.ok)return null;
    return await r.json();
  }catch{return null;}
}
async function apiPatch(cid,data){
  return apiFetch(`/api/contacts/${cid}`,{method:'PATCH',body:JSON.stringify(data)});
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init(){
  const me = await apiFetch('/auth/me');
  if(!me){window.location='/login';return;}
  document.getElementById('sb-username').textContent = me.username;
  document.getElementById('sb-av').textContent = me.username.charAt(0).toUpperCase();

  const [contacts, strat] = await Promise.all([
    apiFetch('/api/contacts'),
    apiFetch('/api/strategic'),
  ]);
  if(!contacts)return;
  G.contacts = contacts;
  G._strat = strat;
  ALL_TEMPLATES = strat?.templates || [];
  ALL_SCRIPTS   = strat?.scripts   || [];
  updSidebar();
  render();
}

function updSidebar(){
  const today_s = today();
  const todayCount = G.contacts.filter(c=>c.next_action_date===today_s || (c.next_action_date&&c.next_action_date<today_s)).length;
  const poeiCount  = G.contacts.filter(c=>c.formation_type==='POEI'||c.formation_type==='Les deux').length;
  const altCount   = G.contacts.filter(c=>c.formation_type==='Alternance'||c.formation_type==='Les deux').length;
  const partCount  = G.contacts.filter(c=>c.segment==='Partner').length;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('bdg-today',todayCount||'—');
  set('bdg-total',G.contacts.length);
  set('bdg-poei',poeiCount);
  set('bdg-alt',altCount);
  set('bdg-part',partCount);

  // sector list
  const sectors=[...new Set(G.contacts.map(c=>c.sector).filter(Boolean))].sort();
  const sb=document.getElementById('sb-sectors');
  if(sb) sb.innerHTML=sectors.map(s=>`<div class="sb-item" data-v="sector-${s}" onclick="setSector('${esc(s)}')" style="padding-left:24px">
    <span class="ic" style="font-size:12px">${s.split(' ')[0]||'🔷'}</span>
    <span class="lbl" style="font-size:11px">${esc(s.replace(/^[^\s]+\s/,''))}</span>
    <span class="bdg bdg-p">${G.contacts.filter(c=>c.sector===s).length}</span>
  </div>`).join('');
}

function setView(v){
  G.view=v; G.q='';
  document.getElementById('tb-search').value='';
  document.querySelectorAll('.sb-item').forEach(el=>{
    el.classList.toggle('active',el.dataset.v===v);
  });
  const title = VIEW_TITLES[v]||v;
  document.getElementById('tb-title').textContent=title;
  document.getElementById('tb-sub').textContent='PBA · Beauté & Esthétique · Groupe DEFIS';
  render();
}
function setSector(s){G.sector=s;G.view='sector';updSidebar();render();}
function onSearch(q){G.q=q.toLowerCase();render();}
function filteredContacts(){
  let l=[...G.contacts];
  if(G.q) l=l.filter(c=>(c.company+c.name+c.sector+c.segment+c.notes+c.next_action).toLowerCase().includes(G.q));
  if(G.filters.seg)  l=l.filter(c=>c.segment===G.filters.seg);
  if(G.filters.type) l=l.filter(c=>c.formation_type===G.filters.type);
  if(G.filters.stage)l=l.filter(c=>c.stage===G.filters.stage);
  return l;
}
async function doLogout(){await fetch('/auth/logout',{method:'POST'});window.location='/login';}
function exportCSV(){window.open('/api/contacts/export');}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  const el=document.getElementById('content');
  const load=(fn)=>{el.innerHTML='<div class="loading-state"><div class="loading-spinner"></div><span>Chargement…</span></div>';fn();};
  if     (G.view==='mission')      load(loadMission);
  else if(G.view==='kanban')       load(loadKanban);
  else if(G.view==='sequences')    load(loadSequencesView);
  else if(G.view==='email-suivi')  load(loadEmailSuivi);
  else if(G.view==='growth')       el.innerHTML=rGrowthDashboard();
  else if(G.view==='pipeline')     el.innerHTML=rPipeline();
  else if(G.view==='partners')     el.innerHTML=rPartners();
  else if(G.view==='strategic')    el.innerHTML=rStrategic();
  else if(G.view==='poei-view')    el.innerHTML=rPoeiView();
  else if(G.view==='alt-view')     el.innerHTML=rAltView();
  else if(G.view==='all-contacts') el.innerHTML=rAllContacts();
  else if(G.view==='sector')       el.innerHTML=rSector(G.sector);
  else if(G.view==='templates')    el.innerHTML=rTemplates();
  else if(G.view==='scripts')      el.innerHTML=rScripts();
  else if(G.view==='metrics')      el.innerHTML=rMetrics();
  else if(G.view==='settings')     el.innerHTML=rSettings();
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function today(){return new Date().toISOString().split('T')[0];}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtEur(n){if(!n)return '0€';if(n>=1000000)return (n/1000000).toFixed(1)+'M€';if(n>=1000)return Math.round(n/1000)+'k€';return n+'€';}
function secColor(s){return SECTOR_COLORS[s]||'#9B2D8E';}
function pipelineVal(c){
  const p=PROB[c.stage]||.05;
  return ((c.nb_postes||0)*3000+(c.nb_alternants||0)*7000)*p;
}
function scoreTag(n){
  const v=n||0;
  const col=v>=80?'#0F9D58':v>=50?'#C2185B':v>=30?'#F5A623':'#999';
  return `<span class="score-tag" style="background:${col}22;color:${col}">★ ${v}</span>`;
}
function segTag(seg){
  const map={Strategic:'seg-Strategic','Quick Win':'seg-Quick','Long Term':'seg-Long',Dormant:'seg-Dormant',Partner:'seg-Partner'};
  return seg?`<span class="seg-badge ${map[seg]||''}">${esc(seg)}</span>`:'';
}
function formTag(ftype){
  if(!ftype)return '';
  if(ftype==='POEI')      return '<span class="form-badge form-badge-poei">POEI</span>';
  if(ftype==='Alternance') return '<span class="form-badge form-badge-alt">Alternance</span>';
  if(ftype==='Les deux')   return '<span class="form-badge form-badge-both">POEI + ALT</span>';
  return '';
}
function stageBadge(stage){
  const col=KB_COLORS[stage]||'#78909C';
  return `<span class="stage-badge" style="background:${col}22;color:${col}">${esc(STAGE_LABELS[stage]||stage)}</span>`;
}
function toast(msg,type=''){
  const el=document.createElement('div');
  el.className='toast'+(type?' '+type:'');
  el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),3000);
}

// ─── MISSION CONTROL ─────────────────────────────────────────────────────────
async function loadMission(){
  const d=await apiFetch('/api/mission');
  if(!d)return;
  document.getElementById('content').innerHTML=rMissionControl(d);
}
function rMissionControl(d){
  const cad=d.cadence||{};
  const today_s=today();
  const dateStr=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  const week=Math.ceil((new Date()-new Date(new Date().getFullYear(),0,1))/604800000);

  function cadBar(key,icon,label,color){
    const item=cad[key]||{done:0,target:1};
    const pct=Math.min(100,Math.round((item.done/item.target)*100));
    return `<div class="cad-item">
      <div class="cad-head"><span>${icon} ${label}</span>
        <input type="number" value="${item.target}" min="1" style="width:44px;background:var(--bg);border:1px solid var(--bd);border-radius:4px;padding:2px 5px;font-size:11px;color:var(--tx)" onchange="saveMissionTarget('${key}',this.value)">
      </div>
      <div class="cad-nums"><span class="cad-done" style="color:${color}">${item.done}</span><span class="cad-target">/ ${item.target}</span></div>
      <div class="cad-bar-track"><div class="cad-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }

  const actions=(d.priority_actions||[]);
  const stuck=(d.stuck||[]);

  return `<div class="mc-wrap">
    <div class="mc-header">
      <div><div class="mc-date">💄 ${dateStr}</div><div class="mc-subtitle">PBA — Beauté & Esthétique · Groupe DEFIS</div></div>
      <div class="mc-week-badge">Semaine ${week}<br><span style="font-size:11px;font-weight:600">${G.contacts.length} entreprises</span></div>
    </div>

    <div class="mc-cadence-grid">
      ${cadBar('emails','📧','Emails',  '#C2185B')}
      ${cadBar('appels','📞','Appels',  '#9B2D8E')}
      ${cadBar('rdv',  '🤝','RDV',     '#0F9D58')}
      ${cadBar('relances','🔄','Relances','#1A73E8')}
    </div>

    <div class="mc-pipeline-row">
      <div class="mc-pipe-card">
        <div class="mc-pipe-label">🎓 Pipeline POEI</div>
        <div class="mc-pipe-val">${fmtEur(d.poei_pipeline||0)}</div>
      </div>
      <div class="mc-pipe-card">
        <div class="mc-pipe-label">🎒 Pipeline Alternance</div>
        <div class="mc-pipe-val">${fmtEur(d.alt_pipeline||0)}</div>
      </div>
    </div>

    <div class="mc-row">
      <div class="mc-panel">
        <div class="mc-panel-title">🔥 Actions prioritaires (${actions.length})</div>
        ${actions.length===0?'<div style="color:var(--mu);font-size:12px">Aucune action urgente 🎉</div>':
          actions.map((c,i)=>`<div class="mc-action-row" onclick="openC(${c.id})">
            <div class="mc-action-rank">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.company)}</div>
              <div style="font-size:10px;color:var(--mu);margin-top:2px;display:flex;gap:6px;align-items:center">
                ${formTag(c.formation_type)}
                <span style="color:${secColor(c.sector)}">${esc(c.sector||'')}</span>
              </div>
              ${c.next_action?`<div style="font-size:10px;color:#666;margin-top:2px">${esc(c.next_action.substring(0,55))}</div>`:''}
            </div>
            ${scoreTag(c.score)}
            ${c.next_action_date<today_s?'<span style="font-size:9px;color:#C2185B;font-weight:800">EN RETARD</span>':''}
          </div>`).join('')}
      </div>
      <div class="mc-panel">
        <div class="mc-panel-title">⏸️ Contacts sans activité (${stuck.length})</div>
        ${stuck.length===0?'<div style="color:var(--mu);font-size:12px">Tous les contacts sont actifs ✅</div>':
          stuck.map(c=>`<div class="mc-stuck-row" onclick="openC(${c.id})">
            <span style="font-size:16px">${(c.sector||'').split(' ')[0]||'💄'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.company)}</div>
              <div style="font-size:10px;color:var(--mu);margin-top:2px;display:flex;gap:5px">
                ${stageBadge(c.stage)}${formTag(c.formation_type)}
              </div>
            </div>
            ${scoreTag(c.score)}
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}
async function saveMissionTarget(key,val){
  const map={emails:'weekly_emails',appels:'weekly_calls',rdv:'weekly_rdv',relances:'weekly_relances'};
  await apiFetch('/api/mission/target',{method:'POST',body:JSON.stringify({[map[key]]:parseInt(val)})});
  toast('Objectif mis à jour','success');
}

// ─── KANBAN ──────────────────────────────────────────────────────────────────
async function loadKanban(){
  G._goals = G._goals || await apiFetch('/api/goals');
  document.getElementById('content').innerHTML = rKanban();
}
function rKanban(){
  const goals=G._goals||{};
  const poeiTarget=goals.poei_target||40, poeiSigned=goals.poei_signed||0;
  const altTarget=goals.alt_target||60,   altSigned=goals.alt_signed||0;
  const caTarget=goals.ca_target||200000, caSigned=goals.ca_signed||0;
  const poeiPct=Math.min(100,Math.round(poeiSigned/poeiTarget*100));
  const altPct =Math.min(100,Math.round(altSigned/altTarget*100));
  const caPct  =Math.min(100,Math.round(caSigned/caTarget*100));

  const byStage={};
  STAGES.forEach(s=>byStage[s]=[]);
  G.contacts.forEach(c=>{const s=c.stage||'Prospect';if(byStage[s])byStage[s].push(c);else byStage['Prospect'].push(c);});

  const stageVals={};
  STAGES.forEach(s=>{stageVals[s]=byStage[s].reduce((sum,c)=>sum+pipelineVal(c),0);});
  const totalPipeline=Object.values(stageVals).reduce((a,b)=>a+b,0);

  return `<div class="kb-page">
    <div class="kb-metrics-row">
      <div class="kb-metric">
        <div class="kb-metric-label">🎓 POEI Signés</div>
        <div class="kb-metric-val" style="color:#C2185B">${poeiSigned} <span class="kb-metric-target">/ ${poeiTarget}</span></div>
        <div class="kb-metric-bar-track"><div class="kb-metric-bar" style="width:${poeiPct}%;background:#C2185B"></div></div>
        <div class="kb-metric-pct">${poeiPct}% de l'objectif</div>
      </div>
      <div class="kb-metric">
        <div class="kb-metric-label">🎒 Alternants Signés</div>
        <div class="kb-metric-val" style="color:#9B2D8E">${altSigned} <span class="kb-metric-target">/ ${altTarget}</span></div>
        <div class="kb-metric-bar-track"><div class="kb-metric-bar" style="width:${altPct}%;background:#9B2D8E"></div></div>
        <div class="kb-metric-pct">${altPct}% de l'objectif</div>
      </div>
      <div class="kb-metric">
        <div class="kb-metric-label">📊 Pipeline Total</div>
        <div class="kb-metric-val" style="color:#0F9D58">${fmtEur(totalPipeline)}</div>
        <div class="kb-metric-pct" style="margin-top:8px">${G.contacts.length} entreprises · pondéré par stage</div>
      </div>
      <div class="kb-metric kb-metric-edit">
        <div class="kb-metric-label">⚙️ Objectifs 2026</div>
        <div class="kb-metric-edit-grid">
          <label>POEI signés</label><input type="number" id="kb-poei-signed" value="${poeiSigned}" min="0">
          <label>Objectif POEI</label><input type="number" id="kb-poei-target" value="${poeiTarget}" min="1">
          <label>Alternants signés</label><input type="number" id="kb-alt-signed" value="${altSigned}" min="0">
          <label>Objectif alternants</label><input type="number" id="kb-alt-target" value="${altTarget}" min="1">
          <label>CA signé (€)</label><input type="number" id="kb-ca-signed" value="${caSigned}" min="0">
          <label>Objectif CA (€)</label><input type="number" id="kb-ca-target" value="${caTarget}" min="1">
        </div>
        <button class="kb-save-btn" onclick="saveGoals()">💾 Sauvegarder</button>
      </div>
    </div>
    <div class="kb-board">
      ${STAGES.map(stage=>{
        const cards=[...(byStage[stage]||[])].sort((a,b)=>(b.score||0)-(a.score||0));
        const col=KB_COLORS[stage];
        return `<div class="kb-col" id="kb-${stage}"
          ondragover="kbDragOver(event,'${stage}')"
          ondragleave="kbDragLeave(event)"
          ondrop="kbDrop(event,'${stage}')">
          <div class="kb-col-head" style="border-top:3px solid ${col}">
            <div><div class="kb-col-name" style="color:${col}">${esc(STAGE_LABELS[stage])}</div>
            <div class="kb-col-val">${fmtEur(stageVals[stage]||0)}</div></div>
            <span class="kb-badge" style="background:${col}22;color:${col}">${cards.length}</span>
          </div>
          <div class="kb-cards-wrap" id="kbc-${stage}">
            ${cards.map(c=>kbCard(c,col)).join('')}
            ${cards.length===0?'<div class="kb-empty">Glisser ici</div>':''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function kbCard(c,col){
  const overdue=c.next_action_date&&c.next_action_date<today();
  return `<div class="kb-card" draggable="true"
    ondragstart="kbDragStart(event,${c.id})"
    ondragend="kbDragEnd(event)"
    onclick="openC(${c.id})">
    <div class="kb-card-stripe" style="background:${col||secColor(c.sector||'')}"></div>
    <div class="kb-card-inner">
      <div class="kb-card-company">${esc(c.company)}</div>
      ${c.sector?`<div class="kb-card-sector" style="color:${secColor(c.sector)}">${esc(c.sector)}</div>`:''}
      <div class="kb-card-tags">${formTag(c.formation_type)}${scoreTag(c.score)}</div>
      ${c.next_action?`<div class="kb-card-action">${esc(c.next_action.substring(0,45))}</div>`:''}
      ${overdue?'<div class="kb-card-overdue">⚠️ EN RETARD</div>':''}
    </div>
  </div>`;
}
function kbDragStart(e,id){_kbDragId=id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',id);setTimeout(()=>e.target.classList.add('kb-dragging'),0);}
function kbDragEnd(e){e.target.classList.remove('kb-dragging');}
function kbDragOver(e,stage){e.preventDefault();e.dataTransfer.dropEffect='move';document.getElementById('kb-'+stage)?.classList.add('kb-drop-target');}
function kbDragLeave(e){if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove('kb-drop-target');}
async function kbDrop(e,newStage){
  e.preventDefault();e.currentTarget.classList.remove('kb-drop-target');
  const id=_kbDragId||parseInt(e.dataTransfer.getData('text/plain'));_kbDragId=null;
  if(!id)return;
  const c=G.contacts.find(x=>x.id===id);
  if(!c||c.stage===newStage)return;
  const oldStage=c.stage;c.stage=newStage;
  document.getElementById('content').innerHTML=rKanban();
  const res=await apiPatch(id,{stage:newStage});
  if(res){G.contacts=G.contacts.map(x=>x.id===id?{...x,stage:newStage}:x);toast(`${esc(c.company)} → ${STAGE_LABELS[newStage]}`,'success');updSidebar();}
  else{c.stage=oldStage;document.getElementById('content').innerHTML=rKanban();}
}
async function saveGoals(){
  const v=id=>parseInt(document.getElementById(id)?.value)||0;
  const data={poei_signed:v('kb-poei-signed'),poei_target:v('kb-poei-target')||40,
    alt_signed:v('kb-alt-signed'),alt_target:v('kb-alt-target')||60,
    ca_signed:v('kb-ca-signed'),ca_target:v('kb-ca-target')||200000};
  const res=await apiFetch('/api/goals',{method:'POST',body:JSON.stringify(data)});
  if(res){G._goals=res.goals;document.getElementById('content').innerHTML=rKanban();toast('Objectifs mis à jour ✅','success');}
}

// ─── SEQUENCES ────────────────────────────────────────────────────────────────
async function loadSequencesView(){
  document.getElementById('content').innerHTML=rSequencesView();
}
function rSequencesView(){
  const seqs=Object.entries(SEQUENCES);
  return `<div class="seq-page">
    <div class="seq-page-header">
      <div class="seq-page-title">⚡ Séquences de Prospection PBA</div>
      <div class="seq-page-sub">Appliquez un workflow automatique à un segment de contacts en 1 clic</div>
    </div>
    <div class="seq-grid">
      ${seqs.map(([key,seq])=>`<div class="seq-card">
        <div class="seq-card-head">
          <div><div class="seq-card-title">${esc(seq.name)}</div><div class="seq-card-sub">${seq.steps.length} étapes sur ${seq.steps[seq.steps.length-1].day} jours</div></div>
          <span class="seq-card-tag">${esc(seq.tag)}</span>
        </div>
        <div class="seq-steps">
          ${seq.steps.map(s=>`<div class="seq-step">
            <span class="seq-step-day">J+${s.day}</span>
            <span class="seq-step-icon">${s.icon}</span>
            <span class="seq-step-label">${esc(s.label)}</span>
          </div>`).join('')}
        </div>
        <div class="seq-card-footer">
          <span class="seq-target-count">${G.contacts.filter(c=>c.formation_type&&c.formation_type!=='').length} contacts éligibles</span>
          <div style="display:flex;gap:6px">
            <button class="seq-apply-btn" onclick="openApplySequence('${key}')">▶ Appliquer</button>
            <button class="seq-apply-btn alt" onclick="openApplySequence('${key}','Strategic')">★ Strategic</button>
          </div>
        </div>
      </div>`).join('')}
    </div>
    <div class="seq-reset-panel">
      <div class="seq-reset-title">🔄 Réinitialisation des dates d'action</div>
      <div class="seq-reset-sub">Repositionner la date de prochaine action pour un segment (ex: relancer toute la base dès demain)</div>
      <div class="seq-reset-row">
        <label>Nouvelle date :</label>
        <input type="date" id="reset-date" value="${today()}">
        <label>Segment :</label>
        <select id="reset-seg" style="background:var(--bg);border:1.5px solid var(--bd);border-radius:6px;padding:5px 10px;font-size:12px;color:var(--tx)">
          <option value="">Tous</option>
          <option>Strategic</option><option>Quick Win</option><option>Long Term</option>
        </select>
        <button class="seq-reset-btn" onclick="bulkResetDates()">🔄 Réinitialiser</button>
      </div>
    </div>
  </div>`;
}
async function openApplySequence(seqKey,segment){
  const seq=SEQUENCES[seqKey];if(!seq)return;
  const first=seq.steps[0];
  let targets=G.contacts.filter(c=>c.formation_type&&c.formation_type!=='');
  if(segment)targets=targets.filter(c=>c.segment===segment);
  if(targets.length===0){toast('Aucun contact éligible','error');return;}
  if(!confirm(`Appliquer "${seq.name}" à ${targets.length} contact(s) ?\nAction J0: ${first.label}`))return;
  let ok=0;
  for(const c of targets){
    const res=await apiPatch(c.id,{next_action:first.label,next_action_date:today(),action_type:first.icon.includes('📞')?'Appel':'Email'});
    if(res){G.contacts=G.contacts.map(x=>x.id===c.id?{...x,...res}:x);ok++;}
  }
  toast(`✅ Séquence appliquée à ${ok} contacts`,'success');
  loadSequencesView();
}
async function bulkResetDates(){
  const date=document.getElementById('reset-date')?.value||today();
  const seg=document.getElementById('reset-seg')?.value||'';
  if(!confirm(`Réinitialiser les dates pour ${seg||'tous les contacts'} au ${date} ?`))return;
  const data=await apiFetch('/api/contacts/bulk-date',{method:'POST',body:JSON.stringify({date,segment:seg||undefined})});
  if(data){G.contacts=data;toast(`✅ Dates réinitialisées`,'success');loadSequencesView();}
}

// ─── GROWTH DASHBOARD ────────────────────────────────────────────────────────
function rGrowthDashboard(){
  const list=G.contacts;
  const pipeline=list.reduce((s,c)=>s+pipelineVal(c),0);
  const poei=list.filter(c=>c.formation_type==='POEI'||c.formation_type==='Les deux');
  const alt =list.filter(c=>c.formation_type==='Alternance'||c.formation_type==='Les deux');
  const strat=list.filter(c=>c.segment==='Strategic');
  const signed=list.filter(c=>c.stage==='Signed');
  const scoreAvg=Math.round(list.reduce((s,c)=>s+(c.score||0),0)/(list.length||1));
  const poeiPipeline=poei.reduce((s,c)=>s+pipelineVal(c),0);
  const altPipeline =alt.reduce((s,c)=>s+pipelineVal(c),0);

  // Top 8
  const seen={};
  const topOpps=list.filter(c=>{if(seen[c.company])return false;seen[c.company]=true;return true;})
    .sort((a,b)=>((b.score||0)*((b.nb_postes||0)+(b.nb_alternants||0)))-((a.score||0)*((a.nb_postes||0)+(a.nb_alternants||0))))
    .slice(0,8);

  // By sector
  const bySector={};
  list.forEach(c=>{const s=c.sector||'Autre';bySector[s]=(bySector[s]||0)+1;});
  const maxSec=Math.max(...Object.values(bySector),1);

  // By stage
  const byStage={};STAGES.forEach(s=>{byStage[s]=list.filter(c=>c.stage===s).length;});

  return `<div style="padding:20px">
    <div class="g-kpi" style="padding:0;margin-bottom:20px">
      <div class="gk-card"><div class="gk-label">Total Contacts</div><div class="gk-val" style="--kpi-color:#9B2D8E">${list.length}</div><div class="gk-sub">${strat.length} Strategic</div></div>
      <div class="gk-card"><div class="gk-label">Pipeline POEI</div><div class="gk-val" style="--kpi-color:#C2185B">${fmtEur(poeiPipeline)}</div><div class="gk-sub">${poei.length} contacts</div></div>
      <div class="gk-card"><div class="gk-label">Pipeline Alternance</div><div class="gk-val" style="--kpi-color:#9B2D8E">${fmtEur(altPipeline)}</div><div class="gk-sub">${alt.length} contacts</div></div>
      <div class="gk-card"><div class="gk-label">Pipeline Total</div><div class="gk-val" style="--kpi-color:#0F9D58">${fmtEur(pipeline)}</div><div class="gk-sub">Pondéré par stage</div></div>
      <div class="gk-card"><div class="gk-label">Score Moyen</div><div class="gk-val" style="--kpi-color:#F5A623">${scoreAvg}</div><div class="gk-sub">/ 100 pts</div></div>
      <div class="gk-card"><div class="gk-label">Signés</div><div class="gk-val" style="--kpi-color:#0F9D58">${signed.length}</div><div class="gk-sub">Contrats actifs</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-header">🏆 Top 8 Opportunités</div>
        <div class="card-body" style="padding:12px">
          <table class="data-table"><thead><tr><th>Entreprise</th><th>Secteur</th><th>Formation</th><th>Score</th><th>Stage</th></tr></thead><tbody>
          ${topOpps.map(c=>`<tr onclick="openC(${c.id})" style="cursor:pointer">
            <td><div style="font-weight:800;font-size:12px">${esc(c.company)}</div></td>
            <td style="color:${secColor(c.sector)};font-size:11px">${esc(c.sector||'')}</td>
            <td>${formTag(c.formation_type)}</td>
            <td>${scoreTag(c.score)}</td>
            <td>${stageBadge(c.stage)}</td>
          </tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header">📊 Pipeline par Stage</div>
          <div class="card-body">
            ${STAGES.map(s=>{const n=byStage[s]||0;const pct=Math.round(n/list.length*100)||0;const col=KB_COLORS[s];
              return `<div class="bar-row"><div class="bar-label" style="color:${col}">${STAGE_LABELS[s]}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
                <div class="bar-num">${n}</div></div>`;}).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-header">💄 Par Secteur Beauté</div>
          <div class="card-body">
            ${Object.entries(bySector).sort((a,b)=>b[1]-a[1]).map(([s,n])=>{const pct=Math.round(n/maxSec*100);const col=secColor(s);
              return `<div class="bar-row"><div class="bar-label" style="color:${col}">${esc(s.replace(/^[^\s]+\s/,''))}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
                <div class="bar-num">${n}</div></div>`;}).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
function rPipeline(){
  let list=filteredContacts();
  return `<div style="padding:20px">
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select onchange="G.filters.seg=this.value;render()" style="background:var(--bg);border:1.5px solid var(--bd);border-radius:7px;padding:6px 10px;font-size:12px;color:var(--tx)">
        <option value="">Tous segments</option>
        <option>Strategic</option><option>Quick Win</option><option>Long Term</option><option>Dormant</option>
      </select>
      <select onchange="G.filters.type=this.value;render()" style="background:var(--bg);border:1.5px solid var(--bd);border-radius:7px;padding:6px 10px;font-size:12px;color:var(--tx)">
        <option value="">POEI + Alternance</option>
        <option value="POEI">POEI uniquement</option>
        <option value="Alternance">Alternance uniquement</option>
        <option value="Les deux">Les deux</option>
      </select>
      <select onchange="G.filters.stage=this.value;render()" style="background:var(--bg);border:1.5px solid var(--bd);border-radius:7px;padding:6px 10px;font-size:12px;color:var(--tx)">
        <option value="">Tous stages</option>
        ${STAGES.map(s=>`<option>${s}</option>`).join('')}
      </select>
      <span style="font-size:12px;color:var(--mu);margin-left:auto">${list.length} contacts</span>
    </div>
    <div class="tbl-wrap card">
      <table class="data-table"><thead><tr>
        <th>Entreprise</th><th>Secteur</th><th>Formation</th><th>Postes POEI</th><th>Alternants</th><th>OPCO</th><th>Stage</th><th>Score</th><th>Action</th>
      </tr></thead><tbody>
        ${list.map(c=>`<tr onclick="openC(${c.id})" style="cursor:pointer">
          <td><div style="font-weight:800">${esc(c.company)}</div><div style="font-size:10px;color:var(--mu)">${esc(c.name||'')}</div></td>
          <td><span style="color:${secColor(c.sector)};font-size:11px;font-weight:700">${esc(c.sector||'')}</span></td>
          <td>${formTag(c.formation_type)}</td>
          <td style="text-align:center;font-weight:800;color:#C2185B">${c.nb_postes||'—'}</td>
          <td style="text-align:center;font-weight:800;color:#9B2D8E">${c.nb_alternants||'—'}</td>
          <td style="font-size:11px;color:var(--ac2)">${esc(c.opco||'')}</td>
          <td>${stageBadge(c.stage)}</td>
          <td>${scoreTag(c.score)}</td>
          <td style="font-size:10px;color:var(--mu);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.next_action||'')}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

// ─── STRATEGIC ────────────────────────────────────────────────────────────────
function rStrategic(){
  const list=G.contacts.filter(c=>c.segment==='Strategic').sort((a,b)=>(b.score||0)-(a.score||0));
  return `<div style="padding:20px">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
      ${list.map(c=>`<div class="card" onclick="openC(${c.id})" style="cursor:pointer;transition:.15s;padding:16px" onmouseenter="this.style.borderColor='#C2185B'" onmouseleave="this.style.borderColor=''">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-weight:900;font-size:13px">${esc(c.company)}</div>
            <div style="font-size:10px;color:${secColor(c.sector)};margin-top:2px;font-weight:700">${esc(c.sector||'')}</div>
          </div>
          ${scoreTag(c.score)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${formTag(c.formation_type)}${stageBadge(c.stage)}
        </div>
        <div style="display:flex;gap:16px;font-size:11px;color:var(--mu)">
          ${c.nb_postes?`<span>🎓 ${c.nb_postes} postes POEI</span>`:''}
          ${c.nb_alternants?`<span>🎒 ${c.nb_alternants} alternants</span>`:''}
        </div>
        ${c.next_action?`<div style="font-size:10px;color:#666;margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">${esc(c.next_action.substring(0,70))}</div>`:''}
      </div>`).join('')}
    </div>
  </div>`;
}

// ─── POEI VIEW ────────────────────────────────────────────────────────────────
function rPoeiView(){
  const list=G.contacts.filter(c=>c.formation_type==='POEI'||c.formation_type==='Les deux').sort((a,b)=>(b.score||0)-(a.score||0));
  const totalPostes=list.reduce((s,c)=>s+(c.nb_postes||0),0);
  return `<div style="padding:20px">
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Entreprises POEI</div><div style="font-size:24px;font-weight:900;color:#C2185B">${list.length}</div></div>
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Postes Potentiels</div><div style="font-size:24px;font-weight:900;color:#C2185B">${totalPostes}</div></div>
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Pipeline POEI</div><div style="font-size:24px;font-weight:900;color:#C2185B">${fmtEur(list.reduce((s,c)=>s+(c.nb_postes||0)*3000*(PROB[c.stage]||.05),0))}</div></div>
    </div>
    <div class="tbl-wrap card">
      <table class="data-table"><thead><tr><th>Entreprise</th><th>Secteur</th><th>Postes</th><th>OPCO</th><th>Stage</th><th>Score</th><th>Prochaine action</th></tr></thead><tbody>
        ${list.map(c=>`<tr onclick="openC(${c.id})" style="cursor:pointer">
          <td><div style="font-weight:800">${esc(c.company)}</div><div style="font-size:10px;color:var(--mu)">${esc(c.name||'')}</div></td>
          <td style="color:${secColor(c.sector)};font-size:11px;font-weight:700">${esc(c.sector||'')}</td>
          <td style="text-align:center;font-weight:900;color:#C2185B;font-size:16px">${c.nb_postes||'—'}</td>
          <td style="font-size:11px;color:var(--ac2)">${esc(c.opco||'')}</td>
          <td>${stageBadge(c.stage)}</td>
          <td>${scoreTag(c.score)}</td>
          <td style="font-size:10px;color:var(--mu)">${esc((c.next_action||'').substring(0,50))}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

// ─── ALTERNANCE VIEW ──────────────────────────────────────────────────────────
function rAltView(){
  const list=G.contacts.filter(c=>c.formation_type==='Alternance'||c.formation_type==='Les deux').sort((a,b)=>(b.score||0)-(a.score||0));
  const totalAlt=list.reduce((s,c)=>s+(c.nb_alternants||0),0);
  return `<div style="padding:20px">
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Entreprises Alternance</div><div style="font-size:24px;font-weight:900;color:#9B2D8E">${list.length}</div></div>
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Alternants Potentiels</div><div style="font-size:24px;font-weight:900;color:#9B2D8E">${totalAlt}</div></div>
      <div class="card" style="padding:14px 20px;flex:1"><div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:4px">Pipeline Alternance</div><div style="font-size:24px;font-weight:900;color:#9B2D8E">${fmtEur(list.reduce((s,c)=>s+(c.nb_alternants||0)*7000*(PROB[c.stage]||.05),0))}</div></div>
    </div>
    <div class="tbl-wrap card">
      <table class="data-table"><thead><tr><th>Entreprise</th><th>Secteur</th><th>Alternants</th><th>Niveau</th><th>OPCO</th><th>Stage</th><th>Score</th></tr></thead><tbody>
        ${list.map(c=>`<tr onclick="openC(${c.id})" style="cursor:pointer">
          <td><div style="font-weight:800">${esc(c.company)}</div></td>
          <td style="color:${secColor(c.sector)};font-size:11px;font-weight:700">${esc(c.sector||'')}</td>
          <td style="text-align:center;font-weight:900;color:#9B2D8E;font-size:16px">${c.nb_alternants||'—'}</td>
          <td style="font-size:11px">${esc(c.formation_level||'')}</td>
          <td style="font-size:11px;color:var(--ac2)">${esc(c.opco||'')}</td>
          <td>${stageBadge(c.stage)}</td>
          <td>${scoreTag(c.score)}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

// ─── ALL CONTACTS ─────────────────────────────────────────────────────────────
function rAllContacts(){
  const list=filteredContacts();
  const groups={};
  list.forEach(c=>{const k=c.company||'—';if(!groups[k])groups[k]=[];groups[k].push(c);});
  const sorted=Object.entries(groups).sort((a,b)=>Math.max(...b[1].map(c=>c.score||0))-Math.max(...a[1].map(c=>c.score||0)));
  return `<div style="padding:20px">
    <div style="margin-bottom:12px;font-size:12px;color:var(--mu)">${list.length} contacts · ${sorted.length} entreprises</div>
    <div class="tbl-wrap card">
      <table class="data-table"><thead><tr><th></th><th>Entreprise / Contact</th><th>Secteur</th><th>Formation</th><th>Stage</th><th>Score</th><th>Action</th></tr></thead><tbody>
        ${sorted.map(([company,contacts],gi)=>{
          const best=contacts[0];const multi=contacts.length>1;
          return `<tr class="company-group-row" id="grp-${gi}" style="background:#fdf8ff;cursor:pointer" onclick="toggleGroup(${gi})">
            <td style="text-align:center;width:30px"><span class="grp-chevron" id="chv-${gi}">${multi?'▶':' '}</span></td>
            <td><div style="font-weight:900;font-size:13px">${esc(company)}</div>
              ${multi?`<div style="font-size:10px;color:var(--mu)">${contacts.length} contacts</div>`:
              `<div style="font-size:11px;color:var(--mu)">${esc(best.name||'')} · ${esc(best.role||'')}</div>`}
            </td>
            <td><span style="color:${secColor(best.sector)};font-size:11px;font-weight:700">${esc(best.sector||'')}</span></td>
            <td>${formTag(best.formation_type)}</td>
            <td>${stageBadge(best.stage)}</td>
            <td>${scoreTag(best.score)}</td>
            <td style="font-size:10px;color:var(--mu)">${esc((best.next_action||'').substring(0,40))}</td>
          </tr>
          ${multi?contacts.map(c=>`<tr id="sub-${gi}-${c.id}" style="display:none;background:#fff">
            <td></td>
            <td style="padding-left:28px"><div style="font-size:12px;font-weight:700">${esc(c.name||'—')}</div><div style="font-size:10px;color:var(--mu)">${esc(c.role||'')}</div></td>
            <td colspan="4"></td>
            <td><button onclick="event.stopPropagation();openC(${c.id})" class="btn btn-s" style="font-size:10px;padding:3px 8px">Voir</button></td>
          </tr>`).join(''):''}`;
        }).join('')}
      </tbody></table>
    </div>
  </div>`;
}
function toggleGroup(gi){
  const chv=document.getElementById('chv-'+gi);
  const rows=document.querySelectorAll(`[id^="sub-${gi}-"]`);
  const open=chv?.textContent==='▼';
  if(chv)chv.textContent=open?'▶':'▼';
  rows.forEach(r=>r.style.display=open?'none':'table-row');
}

// ─── SECTOR ───────────────────────────────────────────────────────────────────
function rSector(sec){
  const list=G.contacts.filter(c=>c.sector===sec).sort((a,b)=>(b.score||0)-(a.score||0));
  return `<div style="padding:20px">
    <h2 style="font-size:16px;font-weight:900;margin-bottom:16px;color:${secColor(sec)}">${esc(sec)} — ${list.length} entreprises</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${list.map(c=>`<div class="card" style="padding:14px;cursor:pointer" onclick="openC(${c.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:13px">${esc(c.company)}</div>${scoreTag(c.score)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${formTag(c.formation_type)}${stageBadge(c.stage)}${segTag(c.segment)}</div>
        <div style="font-size:10px;color:var(--mu)">${esc((c.next_action||'').substring(0,60))}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ─── PARTNERS ─────────────────────────────────────────────────────────────────
function rPartners(){
  const list=G.contacts.filter(c=>c.segment==='Partner').sort((a,b)=>(b.score||0)-(a.score||0));
  const icons={'🤝 Partenaire':'🤝','OPCO':'💼','Mission Locale':'🏛️','CFA':'🎓','Région':'🗺️'};
  return `<div style="padding:20px">
    <div style="margin-bottom:16px;font-size:12px;color:var(--mu)">${list.length} partenaires & prescripteurs</div>
    <div class="partner-cards">
      ${list.map(c=>`<div class="partner-card" onclick="openC(${c.id})">
        <div class="pc-head">
          <div class="pc-logo">${(c.company||'').charAt(0)}</div>
          <div><div class="pc-name">${esc(c.company)}</div><div class="pc-type">${esc(c.role||c.sector||'')}</div></div>
        </div>
        <div style="font-size:11px;color:var(--mu)">${esc(c.name||'')}</div>
        ${c.email?`<div style="font-size:11px;color:#1A73E8;margin-top:4px">✉️ ${esc(c.email)}</div>`:''}
        ${c.opco?`<div class="pc-opco">${esc(c.opco)}</div>`:''}
        <div style="margin-top:10px">${stageBadge(c.stage)}${scoreTag(c.score)}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ─── EMAIL SUIVI ──────────────────────────────────────────────────────────────
async function loadEmailSuivi(){
  const data=await apiFetch('/api/emails/suivi');
  document.getElementById('content').innerHTML=rEmailSuivi(data||[]);
}
function rEmailSuivi(logs){
  const today_s=today();
  const overdue=logs.filter(l=>l.status==='overdue').length;
  const todayC =logs.filter(l=>l.status==='today').length;
  return `<div style="padding:20px">
    <div class="email-status-bar">
      <span class="est-badge est-overdue" onclick="filterEmail('overdue')">⚠️ En retard (${overdue})</span>
      <span class="est-badge est-today" onclick="filterEmail('today')">📅 Aujourd'hui (${todayC})</span>
      <span class="est-badge est-waiting" onclick="filterEmail('sent')">📤 Envoyé</span>
      <span class="est-badge est-ok" onclick="filterEmail('replied')">✅ Répondu</span>
      <span class="est-badge" style="border-color:var(--bd);color:var(--mu)" onclick="filterEmail('all')">Tous (${logs.length})</span>
    </div>
    <div class="tbl-wrap card" id="email-table-wrap">
      <table class="data-table" id="email-table">
        <thead><tr><th>Entreprise</th><th>Contact</th><th>Secteur</th><th>Sujet</th><th>Envoyé</th><th>Relance</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody id="email-tbody">
          ${logs.map(l=>emailRow(l)).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn btn-r" style="margin-top:16px" onclick="openEmailModal(null)">➕ Ajouter suivi email</button>
  </div>`;
}
function emailRow(l){
  const statusMap={overdue:'est-overdue',today:'est-today',replied:'est-ok',sent:'est-waiting',ignored:'seg-Dormant'};
  const statusLabel={overdue:'⚠️ En retard',today:'📅 Aujourd\'hui',replied:'✅ Répondu',sent:'📤 Envoyé',ignored:'❌ Ignoré'};
  return `<tr id="erow-${l.id}" data-status="${l.status||'sent'}">
    <td style="font-weight:800">${esc(l.company)}</td>
    <td style="font-size:11px;color:var(--mu)">${esc(l.name||'')}</td>
    <td style="font-size:11px;color:${secColor(l.sector)};font-weight:700">${esc(l.sector||'')}</td>
    <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.subject||'')}</td>
    <td style="font-size:11px">${l.date||'—'}</td>
    <td style="font-size:11px;color:${l.relance_date<today()?'#C2185B':'var(--mu)'}">${l.relance_date||'—'}</td>
    <td><span class="est-badge ${statusMap[l.status]||'est-waiting'}">${statusLabel[l.status]||l.status}</span></td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-s" style="font-size:10px;padding:3px 7px" onclick="markEmailStatus(${l.id},'replied')">✅</button>
      <button class="btn btn-s" style="font-size:10px;padding:3px 7px" onclick="markEmailStatus(${l.id},'ignored')">❌</button>
    </td>
  </tr>`;
}
function filterEmail(status){
  _emailFilter=status;
  document.querySelectorAll('#email-tbody tr').forEach(tr=>{
    tr.style.display=(status==='all'||tr.dataset.status===status)?'':'none';
  });
}
function openEmailModal(cid){
  G_emailContactId=cid;
  const c=cid?G.contacts.find(x=>x.id===cid):null;
  document.getElementById('email-modal-title').textContent=c?`Suivi — ${c.company}`:'Nouveau suivi email';
  document.getElementById('email-modal-body').innerHTML=`
    <div class="modal-field"><label class="modal-label">Sujet</label><input class="modal-input" id="em-subject" value="${esc(c?.next_action||'')}" placeholder="Ex: Présentation POEI Beauté"></div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Date envoi</label><input type="date" class="modal-input" id="em-date" value="${today()}"></div>
      <div class="modal-field"><label class="modal-label">Date relance</label><input type="date" class="modal-input" id="em-relance"></div>
    </div>
    <div class="modal-field"><label class="modal-label">Note</label><textarea class="modal-input" id="em-note" rows="3" placeholder="Commentaire…"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-s" onclick="closeEmailModal()">Annuler</button>
      <button class="btn btn-r" onclick="saveEmailLog()">💾 Enregistrer</button>
    </div>`;
  document.getElementById('email-overlay').style.display='flex';
}
function closeEmailModal(){document.getElementById('email-overlay').style.display='none';}
async function saveEmailLog(){
  if(!G_emailContactId){toast('Sélectionne un contact d\'abord','error');return;}
  const data={action:'Email',subject:document.getElementById('em-subject')?.value||'',
    date:document.getElementById('em-date')?.value||today(),
    relance_date:document.getElementById('em-relance')?.value||'',
    note:document.getElementById('em-note')?.value||'',status:'sent'};
  const res=await apiFetch(`/api/contacts/${G_emailContactId}/log`,{method:'POST',body:JSON.stringify(data)});
  if(res){toast('Email enregistré ✅','success');closeEmailModal();loadEmailSuivi();}
  else toast('Erreur','error');
}
async function markEmailStatus(logId,status){
  await apiFetch(`/api/emails/log/${logId}`,{method:'PATCH',body:JSON.stringify({status})});
  const row=document.getElementById('erow-'+logId);
  if(row){row.dataset.status=status;loadEmailSuivi();}
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function rTemplates(){
  return `<div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    ${ALL_TEMPLATES.map(t=>`<div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <span>${esc(t.name)}</span>
        <button class="btn btn-s" style="font-size:11px" onclick="navigator.clipboard.writeText(${JSON.stringify(t.body||'').replace(/'/g,"&#39;")}).then(()=>toast('Copié !','success'))">📋 Copier</button>
      </div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--mu);margin-bottom:8px">Objet : <strong>${esc(t.subject||'')}</strong></div>
        <pre style="font-size:12px;white-space:pre-wrap;font-family:inherit;color:var(--tx);background:var(--bg);padding:12px;border-radius:8px;line-height:1.6">${esc(t.body||'')}</pre>
      </div>
    </div>`).join('')}
  </div>`;
}

// ─── SCRIPTS ──────────────────────────────────────────────────────────────────
function rScripts(){
  return `<div style="padding:20px;display:flex;flex-direction:column;gap:14px">
    ${ALL_SCRIPTS.map(s=>`<div class="card">
      <div class="card-header">${esc(s.name)}</div>
      <div class="card-body">
        <ol style="padding-left:18px;display:flex;flex-direction:column;gap:8px">
          ${(s.steps||[]).map(step=>`<li style="font-size:13px;color:var(--tx);line-height:1.5">${esc(step)}</li>`).join('')}
        </ol>
      </div>
    </div>`).join('')}
  </div>`;
}

// ─── METRICS ──────────────────────────────────────────────────────────────────
function rMetrics(){
  const list=G.contacts;
  const poei=list.filter(c=>c.formation_type==='POEI'||c.formation_type==='Les deux');
  const alt =list.filter(c=>c.formation_type==='Alternance'||c.formation_type==='Les deux');
  const poeiPipeline=poei.reduce((s,c)=>s+(c.nb_postes||0)*3000*(PROB[c.stage]||.05),0);
  const altPipeline =alt.reduce((s,c)=>s+(c.nb_alternants||0)*7000*(PROB[c.stage]||.05),0);
  const byStage={};STAGES.forEach(s=>{byStage[s]=list.filter(c=>c.stage===s).length;});

  return `<div style="padding:20px;display:flex;flex-direction:column;gap:16px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="card" style="padding:16px">
        <div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:8px">Pipeline POEI</div>
        <div style="font-size:28px;font-weight:900;color:#C2185B">${fmtEur(poeiPipeline)}</div>
        <div style="font-size:11px;color:var(--mu);margin-top:4px">${poei.reduce((s,c)=>s+(c.nb_postes||0),0)} postes · ${poei.length} entreprises</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:8px">Pipeline Alternance</div>
        <div style="font-size:28px;font-weight:900;color:#9B2D8E">${fmtEur(altPipeline)}</div>
        <div style="font-size:11px;color:var(--mu);margin-top:4px">${alt.reduce((s,c)=>s+(c.nb_alternants||0),0)} alternants · ${alt.length} entreprises</div>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;margin-bottom:8px">Pipeline Total</div>
        <div style="font-size:28px;font-weight:900;color:#0F9D58">${fmtEur(poeiPipeline+altPipeline)}</div>
        <div style="font-size:11px;color:var(--mu);margin-top:4px">${list.length} entreprises totales</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">📊 Entonnoir de conversion</div>
      <div class="card-body">
        ${STAGES.map(s=>{const n=byStage[s]||0;const pct=Math.round(n/(list.length||1)*100);const col=KB_COLORS[s];
          return `<div class="bar-row"><div class="bar-label" style="color:${col}">${STAGE_LABELS[s]}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct||1}%;background:${col}"></div></div>
            <div class="bar-num" style="color:${col}">${n} <span style="font-size:9px;color:var(--mu)">(${pct}%)</span></div></div>`;}).join('')}
      </div>
    </div>
  </div>`;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function rSettings(){
  return `<div class="settings-wrap">
    <div class="settings-section">
      <h3>👥 Équipe PBA</h3>
      <div id="users-list"><div style="color:var(--mu);font-size:12px">Chargement…</div></div>
    </div>
    <div class="settings-section">
      <h3>ℹ️ Informations CRM</h3>
      <div style="font-size:13px;color:var(--tx);line-height:2">
        <div>🏢 <strong>PBA</strong> — Paris Beauté Alternance</div>
        <div>🏛️ Groupe <strong>DEFIS</strong></div>
        <div>🎓 Formations : POEI + Alternance (CAP, BP, BTS Esthétique)</div>
        <div>💼 OPCO : OPCO EP · OPCO Atlas</div>
        <div>📍 Île-de-France</div>
        <div>🌐 <strong>localhost:5051</strong></div>
      </div>
    </div>
  </div>`;
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
async function openC(id){
  document.getElementById('modal-overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML='<div class="loading-state" style="min-height:150px"><div class="loading-spinner"></div></div>';
  const c=await apiFetch(`/api/contacts/${id}`);
  if(!c){closeModal();return;}
  G.selId=id;
  document.getElementById('modal-title').textContent=c.company;
  document.getElementById('modal-body').innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${formTag(c.formation_type)}${stageBadge(c.stage)}${segTag(c.segment)}${scoreTag(c.score)}
    </div>
    <div class="modal-row" style="margin-bottom:16px">
      <div><div class="modal-label">Contact</div><div style="font-size:13px;font-weight:700">${esc(c.name||'—')}</div><div style="font-size:11px;color:var(--mu)">${esc(c.role||'')}</div></div>
      <div><div class="modal-label">Secteur</div><div style="font-size:13px;font-weight:700;color:${secColor(c.sector)}">${esc(c.sector||'—')}</div></div>
    </div>
    <div class="modal-row" style="margin-bottom:16px">
      <div><div class="modal-label">Email</div><div style="font-size:12px">${c.email?`<a href="mailto:${esc(c.email)}" style="color:#1A73E8">${esc(c.email)}</a>`:'—'}</div></div>
      <div><div class="modal-label">Téléphone</div><div style="font-size:12px">${esc(c.phone||'—')}</div></div>
    </div>
    <div class="modal-row" style="margin-bottom:16px">
      <div><div class="modal-label">🎓 Postes POEI</div><div style="font-size:20px;font-weight:900;color:#C2185B">${c.nb_postes||'—'}</div></div>
      <div><div class="modal-label">🎒 Alternants</div><div style="font-size:20px;font-weight:900;color:#9B2D8E">${c.nb_alternants||'—'}</div></div>
    </div>
    ${c.opco?`<div style="margin-bottom:12px"><div class="modal-label">OPCO</div><span style="background:var(--pl);color:var(--ac2);padding:3px 10px;border-radius:8px;font-size:12px;font-weight:700">${esc(c.opco)}</span></div>`:''}
    ${c.notes?`<div style="margin-bottom:12px"><div class="modal-label">Notes</div><div style="font-size:12px;color:var(--tx);background:var(--bg);padding:10px;border-radius:8px;line-height:1.6">${esc(c.notes)}</div></div>`:''}

    <div style="border-top:1px solid var(--bd);margin:16px 0;padding-top:16px">
      <div class="modal-label" style="margin-bottom:10px">Changer le stage</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${STAGES.map(s=>`<button onclick="changeStage(${c.id},'${s}')" style="background:${s===c.stage?KB_COLORS[s]+'22':'var(--bg)'};border:1.5px solid ${KB_COLORS[s]};color:${KB_COLORS[s]};border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">${STAGE_LABELS[s]}</button>`).join('')}
      </div>
    </div>

    <div style="border-top:1px solid var(--bd);margin:16px 0;padding-top:16px">
      <div class="modal-label" style="margin-bottom:10px">Ajouter une action</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${['Email','Appel','RDV','LinkedIn'].map(a=>`<button onclick="addLog(${c.id},'${a}')" class="btn btn-s" style="font-size:11px">
          ${{Email:'📧',Appel:'📞',RDV:'🤝',LinkedIn:'💼'}[a]} ${a}
        </button>`).join('')}
      </div>
      <textarea id="log-note-${c.id}" class="modal-input" rows="2" placeholder="Note…" style="margin-bottom:8px"></textarea>
    </div>

    ${(c.logs||[]).length>0?`<div style="border-top:1px solid var(--bd);margin-top:8px;padding-top:12px">
      <div class="modal-label" style="margin-bottom:8px">Historique (${c.logs.length})</div>
      ${c.logs.slice().reverse().slice(0,8).map(l=>`<div class="log-item">
        <div class="log-icon">${{Email:'📧',Appel:'📞',RDV:'🤝',LinkedIn:'💼',Convention:'📝'}[l.action]||'📌'}</div>
        <div><div style="font-size:12px;font-weight:700">${esc(l.action||'')} <span style="font-size:10px;color:var(--mu);font-weight:400">${l.date||''}</span></div>
        ${l.note?`<div style="font-size:11px;color:var(--mu)">${esc(l.note)}</div>`:''}
        </div>
      </div>`).join('')}
    </div>`:''}

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--bd)">
      <button class="btn btn-s" onclick="openEmailModal(${c.id})">📧 Suivi Email</button>
      <button class="btn btn-s" onclick="markDone(${c.id})">✅ Action faite</button>
      <button class="btn btn-r" onclick="closeModal()">Fermer</button>
    </div>`;
}
function closeModal(){document.getElementById('modal-overlay').style.display='none';}

async function changeStage(cid,stage){
  const res=await apiPatch(cid,{stage});
  if(res){G.contacts=G.contacts.map(c=>c.id===cid?{...c,stage}:c);toast(`Stage → ${STAGE_LABELS[stage]}`,'success');openC(cid);updSidebar();}
}
async function addLog(cid,action){
  const note=document.getElementById(`log-note-${cid}`)?.value||'';
  const res=await apiFetch(`/api/contacts/${cid}/log`,{method:'POST',body:JSON.stringify({action,note,done:true,date:today()})});
  if(res){toast(`${action} enregistré ✅`,'success');openC(cid);}
}
async function markDone(cid){
  const c=G.contacts.find(x=>x.id===cid);
  const res=await apiFetch(`/api/contacts/${cid}/done`,{method:'POST',body:JSON.stringify({action_type:c?.action_type||'Email'})});
  if(res){G.contacts=G.contacts.map(x=>x.id===cid?{...x,...res}:x);toast('Action marquée faite ✅ +score','success');openC(cid);updSidebar();}
}

// ─── CONTACT FORM ─────────────────────────────────────────────────────────────
function openContactForm(){
  document.getElementById('modal-title').textContent='Nouveau Contact';
  document.getElementById('modal-overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML=`
    <div class="form-section-title">Entreprise</div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Entreprise *</label><input class="modal-input" id="f-company" placeholder="Ex: Dessange Paris"></div>
      <div class="modal-field"><label class="modal-label">Secteur</label>
        <select class="modal-input" id="f-sector">
          ${Object.keys(SECTOR_COLORS).map(s=>`<option>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-section-title">Contact</div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Nom</label><input class="modal-input" id="f-name" placeholder="Marie Dupont"></div>
      <div class="modal-field"><label class="modal-label">Fonction</label><input class="modal-input" id="f-role" placeholder="DRH, Gérant…"></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Email</label><input class="modal-input" id="f-email" type="email"></div>
      <div class="modal-field"><label class="modal-label">Téléphone</label><input class="modal-input" id="f-phone"></div>
    </div>
    <div class="form-section-title">Formation</div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Type</label>
        <select class="modal-input" id="f-ftype">
          <option value="">—</option><option>POEI</option><option>Alternance</option><option>Les deux</option>
        </select>
      </div>
      <div class="modal-field"><label class="modal-label">Niveau</label>
        <select class="modal-input" id="f-flevel">
          <option value="">—</option><option>CAP Esthétique</option><option>BP Esthétique</option><option>BTS Esthétique</option><option>CQP Esthéticienne</option><option>BAC PRO Esthétique</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">Nb postes POEI</label><input class="modal-input" id="f-postes" type="number" value="0" min="0"></div>
      <div class="modal-field"><label class="modal-label">Nb alternants</label><input class="modal-input" id="f-alt" type="number" value="0" min="0"></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label class="modal-label">OPCO</label>
        <select class="modal-input" id="f-opco">
          <option value="">—</option><option>OPCO EP</option><option>OPCO Atlas</option><option>Autre</option>
        </select>
      </div>
      <div class="modal-field"><label class="modal-label">Segment</label>
        <select class="modal-input" id="f-seg">
          <option>Long Term</option><option>Quick Win</option><option>Strategic</option><option>Dormant</option><option>Partner</option>
        </select>
      </div>
    </div>
    <div class="modal-field"><label class="modal-label">Prochaine action</label><input class="modal-input" id="f-action" placeholder="Ex: Envoyer email POEI"></div>
    <div class="modal-field"><label class="modal-label">Date action</label><input class="modal-input" id="f-adate" type="date" value="${today()}"></div>
    <div class="modal-field"><label class="modal-label">Notes</label><textarea class="modal-input" id="f-notes" rows="3"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
      <button class="btn btn-s" onclick="closeModal()">Annuler</button>
      <button class="btn btn-r" onclick="saveContact()">💾 Enregistrer</button>
    </div>`;
}
async function saveContact(){
  const g=id=>document.getElementById(id)?.value||'';
  const data={company:g('f-company'),name:g('f-name'),role:g('f-role'),email:g('f-email'),phone:g('f-phone'),
    sector:g('f-sector'),segment:g('f-seg'),formation_type:g('f-ftype'),formation_level:g('f-flevel'),
    nb_postes:parseInt(g('f-postes'))||0,nb_alternants:parseInt(g('f-alt'))||0,opco:g('f-opco'),
    next_action:g('f-action'),next_action_date:g('f-adate'),notes:g('f-notes')};
  if(!data.company.trim()){toast('Entreprise obligatoire','error');return;}
  const res=await apiFetch('/api/contacts',{method:'POST',body:JSON.stringify(data)});
  if(res){G.contacts=[res,...G.contacts];toast('Contact ajouté ✅','success');closeModal();updSidebar();render();}
}

// ─── START ────────────────────────────────────────────────────────────────────
init();
