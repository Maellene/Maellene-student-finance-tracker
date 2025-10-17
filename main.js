// ===== simple Student Finance Tracker (clean & readable) =====

// Elements
const navBtns = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');

const txnForm = document.getElementById('txnForm');
const descI = document.getElementById('desc');
const amtI = document.getElementById('amt');
const catI = document.getElementById('cat');
const dtI = document.getElementById('dt');
const txnIdI = document.getElementById('txnId');

const recordsTable = document.getElementById('recordsTable');
const noRecords = document.getElementById('noRecords');

const totalCount = document.getElementById('totalCount');
const totalSum = document.getElementById('totalSum');
const topCat = document.getElementById('topCat');
const remainingCapEl = document.getElementById('remainingCap');
const capStatus = document.getElementById('capStatus');

const capInput = document.getElementById('cap');
const currencySelect = document.getElementById('currency');
const rateUSD = document.getElementById('rateUSD');
const rateEUR = document.getElementById('rateEUR');

const searchInput = document.getElementById('searchInput');
const toggleCaseBtn = document.getElementById('toggleCase');
const sortDateBtn = document.getElementById('sortDate');
const sortDescBtn = document.getElementById('sortDesc');
const sortAmtBtn = document.getElementById('sortAmt');

const saveSettingsBtn = document.getElementById('saveSettings');
const resetSettingsBtn = document.getElementById('resetSettings');

const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');

const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

// State & storage keys
const KEY = 'sft-records';
const KEY_CAP = 'sft-cap';
const KEY_CUR = 'sft-currency';
const KEY_RATES = 'sft-rates';

let records = JSON.parse(localStorage.getItem(KEY) || '[]');
let cap = parseFloat(localStorage.getItem(KEY_CAP)) || 0;
let currency = localStorage.getItem(KEY_CUR) || 'RWF';
let rates = JSON.parse(localStorage.getItem(KEY_RATES)) || { RWF:1, USD:0.00093, EUR:0.00085 };

// UI navigation
navBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    navBtns.forEach(x=>x.classList.remove('active'));
    panels.forEach(p=>p.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.target).classList.add('active');
  });
});

// ---------- Validators (4 rules + advanced backref) ----------
const validators = {
  desc: v => /^\S(?:.*\S)?$/.test(v) && !(/\b(\w+)\s+\1\b/.test(v)), // no leading/trailing, no duplicate adjacent words
  amt: v => /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(v)),
  date: v => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v),
  cat: v => /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/.test(v)
};
function showError(id,msg){ document.getElementById(id).textContent = msg; }

// safe regex compiler
function compileRegex(input, flags='i'){
  try { return input ? new RegExp(input, flags) : null; }
  catch { return null; }
}
function highlight(text, re){
  if(!re) return text;
  return text.replace(re, m => `<mark>${m}</mark>`);
}

// formatting with currency
function formatAmount(value){
  const r = rates[currency] || 1;
  return `${currency} ${ (value * r).toFixed(2) }`;
}

// ---------- Render & Dashboard ----------
let caseSensitive = false;
let sortField = null;
let sortAsc = true;

function updateDashboard(){
  totalCount.textContent = records.length;
  const sum = records.reduce((s,r)=> s + Number(r.amt), 0);
  totalSum.textContent = formatAmount(sum);

  const catMap = {};
  records.forEach(r => catMap[r.cat] = (catMap[r.cat] || 0) + Number(r.amt));
  topCat.textContent = Object.keys(catMap).sort((a,b)=> (catMap[b]||0)-(catMap[a]||0))[0] || '—';

  // remaining = cap - totalSpent (cap and amounts are in base currency)
  const remaining = cap - sum;
  remainingCapEl.textContent = formatAmount(remaining);
  // aria live polite/assertive
  if(cap === 0) {
    capStatus.textContent = 'No cap set.';
    capStatus.setAttribute('aria-live','polite');
  } else if (remaining < 0) {
    capStatus.textContent = '⚠ Over your monthly cap!';
    capStatus.setAttribute('aria-live','assertive');
  } else {
    capStatus.textContent = `You have ${formatAmount(remaining)} remaining.`;
    capStatus.setAttribute('aria-live','polite');
  }
}

function renderRecords(){
  recordsTable.innerHTML = '';
  const pattern = searchInput.value.trim();
  const re = compileRegex(pattern, caseSensitive ? '' : 'i');

  let list = records.slice();

  // sorting
  if(sortField){
    list.sort((a,b)=>{
      if(a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
      if(a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
      return 0;
    });
  }

  // filtering with regex
  const filtered = list.filter(r => {
    if(!re) return true;
    return re.test(r.desc) || re.test(r.cat) || re.test(String(r.amt)) || re.test(r.dt);
  });

  if(filtered.length === 0){
    noRecords.style.display = 'block';
    return;
  }
  noRecords.style.display = 'none';

  filtered.forEach(r=>{
    const tr = document.createElement('tr');
    const reSafe = re;
    tr.innerHTML = `
      <td>${ reSafe ? highlight(r.dt, reSafe) : r.dt }</td>
      <td>${ reSafe ? highlight(escapeHtml(r.desc), reSafe) : escapeHtml(r.desc) }</td>
      <td>${ reSafe ? highlight(escapeHtml(r.cat), reSafe) : escapeHtml(r.cat) }</td>
      <td>${ reSafe ? highlight(formatAmount(Number(r.amt)), reSafe) : formatAmount(Number(r.amt)) }</td>
      <td>
        <button onclick="editRecord('${r.id}')">Edit</button>
        <button onclick="deleteRecord('${r.id}')">Delete</button>
      </td>
    `;
    recordsTable.appendChild(tr);
  });
  updateDashboard();
}

// escape HTML
function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// ---------- Form submit (add/edit) ----------
txnForm.addEventListener('submit', e=>{
  e.preventDefault();
  // validation
  const d = descI.value.trim();
  const a = amtI.value.trim();
  const c = catI.value.trim();
  const dt = dtI.value;

  let ok = true;
  if(!validators.desc(d)){ showError('err-desc','Bad description (no edges or duplicate words).'); ok=false } else showError('err-desc','');
  if(!validators.amt(a)){ showError('err-amt','Enter positive number (up to 2 decimals).'); ok=false } else showError('err-amt','');
  if(!validators.cat(c)){ showError('err-cat','Letters, spaces or hyphens only.'); ok=false } else showError('err-cat','');
  if(!validators.date(dt)){ showError('err-dt','Use YYYY-MM-DD.'); ok=false } else showError('err-dt','');

  if(!ok) return;

  const id = txnIdI.value || crypto.randomUUID();
  const now = new Date().toISOString();
  const rec = {
    id,
    desc: d.replace(/\s+/g,' '),
    amt: Number(a),
    cat: c,
    dt,
    createdAt: txnIdI.value ? (records.find(r=>r.id===id).createdAt) : now,
    updatedAt: now
  };

  const idx = records.findIndex(r => r.id === id);
  if(idx > -1) records[idx] = rec;
  else records.push(rec);

  localStorage.setItem(KEY, JSON.stringify(records));
  txnForm.reset();
  txnIdI.value = '';
  renderRecords();
  // go to dashboard
  document.querySelector('[data-target="dashboard"]').click();
});

// ---------- Edit / Delete ----------
window.editRecord = id => {
  const r = records.find(x => x.id === id);
  if(!r) return;
  txnIdI.value = r.id;
  descI.value = r.desc;
  amtI.value = r.amt;
  catI.value = r.cat;
  dtI.value = r.dt;
  document.querySelector('[data-target="form"]').click();
};

window.deleteRecord = id => {
  if(!confirm('Delete this record?')) return;
  records = records.filter(r => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(records));
  renderRecords();
};

// ---------- Reset form
resetBtn.addEventListener('click', ()=> txnForm.reset());

// ---------- Settings save/reset ----------
saveSettingsBtn.addEventListener('click', ()=>{
  cap = parseFloat(capInput.value) || 0;
  currency = currencySelect.value;
  // manual rates if provided
  const rUSD = parseFloat(rateUSD.value);
  const rEUR = parseFloat(rateEUR.value);
  if(!isNaN(rUSD) && rUSD>0) rates.USD = rUSD;
  if(!isNaN(rEUR) && rEUR>0) rates.EUR = rEUR;

  localStorage.setItem(KEY_CAP, cap);
  localStorage.setItem(KEY_CUR, currency);
  localStorage.setItem(KEY_RATES, JSON.stringify(rates));
  updateDashboard();
  renderRecords();
  alert('Settings saved!');
});

resetSettingsBtn.addEventListener('click', ()=>{
  cap = 0;
  currency = 'RWF';
  rates = { RWF:1, USD:0.00093, EUR:0.00085 };
  capInput.value = '';
  currencySelect.value = 'RWF';
  rateUSD.value = '';
  rateEUR.value = '';
  localStorage.setItem(KEY_CAP, cap);
  localStorage.setItem(KEY_CUR, currency);
  localStorage.setItem(KEY_RATES, JSON.stringify(rates));
  updateDashboard();
  renderRecords();
  alert('Settings reset.');
});

// ---------- Search & Sort controls ----------
searchInput.addEventListener('input', renderRecords);
toggleCaseBtn.addEventListener('click', ()=>{ caseSensitive = !caseSensitive; toggleCaseBtn.classList.toggle('active'); renderRecords(); });

sortDateBtn.addEventListener('click', ()=>{ if(sortField==='dt') sortAsc=!sortAsc; else { sortField='dt'; sortAsc=true } renderRecords(); });
sortDescBtn.addEventListener('click', ()=>{ if(sortField==='desc') sortAsc=!sortAsc; else { sortField='desc'; sortAsc=true } renderRecords(); });
sortAmtBtn.addEventListener('click', ()=>{ if(sortField==='amt') sortAsc=!sortAsc; else { sortField='amt'; sortAsc=false } renderRecords(); });

// ---------- Import / Export JSON ----------
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'records.json'; a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', ()=>{
  const file = importFile.files[0];
  if(!file) return alert('Select a JSON file first.');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if(!Array.isArray(imported)) throw 0;
      // validate and normalize
      records = imported.map(item => ({
        id: item.id || crypto.randomUUID(),
        desc: item.description || item.desc || String(item.desc||''),
        amt: Number(item.amount ?? item.amt ?? 0),
        cat: item.category || item.cat || 'Other',
        dt: item.date || item.dt || new Date().toISOString().slice(0,10),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      }));
      localStorage.setItem(KEY, JSON.stringify(records));
      renderRecords();
      alert('Imported successfully.');
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
});

// ---------- Init (load settings)
(function init(){
  // load saved settings
  cap = parseFloat(localStorage.getItem(KEY_CAP)) || 0;
  currency = localStorage.getItem(KEY_CUR) || 'RWF';
  rates = JSON.parse(localStorage.getItem(KEY_RATES)) || rates;

  capInput.value = cap || '';
  currencySelect.value = currency || 'RWF';
  rateUSD.value = rates.USD || '';
  rateEUR.value = rates.EUR || '';

  // seed sample if empty (optional)
  if(records.length === 0){
    // do not override if user already has data
    records = JSON.parse(localStorage.getItem(KEY) || '[]');
  }

  renderRecords();
})();
