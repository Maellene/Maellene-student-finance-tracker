// ======= Elements =======
const navBtns = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");

const form = document.getElementById("txnForm");
const desc = document.getElementById("desc");
const amt = document.getElementById("amt");
const cat = document.getElementById("cat");
const dt = document.getElementById("dt");
const txnId = document.getElementById("txnId");

const recordsTable = document.getElementById("recordsTable");
const noRecords = document.getElementById("noRecords");

const totalCount = document.getElementById("totalCount");
const totalSum = document.getElementById("totalSum");
const topCat = document.getElementById("topCat");
const remainingCap = document.getElementById("remainingCap");

const capInput = document.getElementById("cap");

// ======= Storage =======
let records = JSON.parse(localStorage.getItem("sft-records")) || [];
let cap = parseFloat(localStorage.getItem("sft-cap")) || 0;

// ======= Navigation =======
navBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    navBtns.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    panels.forEach(p=>p.classList.remove("active"));
    document.getElementById(btn.dataset.target).classList.add("active");
  });
});

// ======= Render Records =======
function renderRecords(){
  recordsTable.innerHTML = "";
  if(records.length===0){
    noRecords.style.display="block";
  }else{
    noRecords.style.display="none";
    records.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML=`
        <td>${r.dt}</td>
        <td>${r.desc}</td>
        <td>${r.cat}</td>
        <td>${r.amt.toFixed(2)}</td>
        <td>
          <button onclick="editRecord('${r.id}')">Edit</button>
          <button onclick="deleteRecord('${r.id}')">Delete</button>
        </td>
      `;
      recordsTable.appendChild(tr);
    });
  }
  updateDashboard();
}

// ======= Dashboard =======
function updateDashboard(){
  totalCount.textContent = records.length;
  const sum = records.reduce((s,r)=>s+r.amt,0);
  totalSum.textContent = `RWF ${sum.toFixed(2)}`;
  const catSum = {};
  records.forEach(r=>catSum[r.cat]=(catSum[r.cat]||0)+r.amt);
  topCat.textContent = Object.keys(catSum).sort((a,b)=>catSum[b]-catSum[a])[0]||"—";
  remainingCap.textContent = `RWF ${(cap-sum).toFixed(2)}`;
}

// ======= Form Submit =======
form.addEventListener("submit", e=>{
  e.preventDefault();
  const id = txnId.value || crypto.randomUUID();
  const record = {id, desc: desc.value, amt: parseFloat(amt.value), cat: cat.value, dt: dt.value};
  const index = records.findIndex(r=>r.id===id);
  if(index>=0) records[index]=record; else records.push(record);
  localStorage.setItem("sft-records", JSON.stringify(records));
  form.reset(); txnId.value="";
  renderRecords();
  navBtns[0].click(); // go to dashboard
});

// ======= Edit/Delete =======
window.editRecord = id=>{
  const r = records.find(r=>r.id===id);
  txnId.value = r.id; desc.value=r.desc; amt.value=r.amt; cat.value=r.cat; dt.value=r.dt;
  navBtns.forEach(b=>b.classList.remove("active"));
  panels.forEach(p=>p.classList.remove("active"));
  document.getElementById("form").classList.add("active");
};

window.deleteRecord = id=>{
  if(confirm("Delete this record?")){
    records = records.filter(r=>r.id!==id);
    localStorage.setItem("sft-records", JSON.stringify(records));
    renderRecords();
  }
};

// ======= Reset Buttons =======
document.getElementById("resetBtn").addEventListener("click",()=>form.reset());
document.getElementById("saveSettings").addEventListener("click",()=>{
  cap = parseFloat(capInput.value)||0;
  localStorage.setItem("sft-cap", cap);
  updateDashboard();
  alert("Settings saved!");
});
document.getElementById("resetSettings").addEventListener("click",()=>{
  capInput.value=""; cap=0;
  localStorage.setItem("sft-cap", cap);
  updateDashboard();
});

// ======= Initial Render =======
capInput.value = cap;
renderRecords();
