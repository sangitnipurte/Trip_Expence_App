// ── CONSTANTS ──────────────────────────────────────────────
const API = 'https://trip-expence-app.onrender.com/api';
const AVCOLS = ['#e85d26','#2e7d6b','#5b5bd6','#d97706','#dc2626','#0891b2','#7c3aed','#be185d','#059669','#ea580c'];
const CICONS = { food: '🍽️', transport: '🚗', hotel: '🏨', activity: '🎯', other: '📦' };
const CLBLS  = { food: 'Food', transport: 'Transport', hotel: 'Hotel', activity: 'Activity', other: 'Other' };
const CCOLS  = { food: '#e85d26', transport: '#2563eb', hotel: '#7c3aed', activity: '#2e7d6b', other: '#78716c' };
const CBG    = { food: '#fff0ea', transport: '#eff6ff', hotel: '#f5f3ff', activity: '#ecfdf5', other: '#f5f4f2' };
const EMOJIS = ['🏖️','🏔️','🌿','🏙️','🎿','🏕️','🌊','🏝️','🗺️','✈️','🚂','🚢','🌄','🏯','🎭','🎪'];
const TCOLORS = [
  'linear-gradient(135deg,#1e4d7b,#0d3159)',
  'linear-gradient(135deg,#2d1f3d,#1a1028)',
  'linear-gradient(135deg,#1a3020,#0c2010)',
  'linear-gradient(135deg,#7c1d2e,#4a0f1c)',
  'linear-gradient(135deg,#1a2040,#0d1428)',
  'linear-gradient(135deg,#3d2a0a,#241905)'
];
const TCOLPREV = ['#1e4d7b','#2d1f3d','#1a3020','#7c1d2e','#1a2040','#3d2a0a'];

// ── STATE ──────────────────────────────────────────────────
let trips = [], expenses = [], summary = { balances: {}, settlements: [] };
let activeTrip = null, expFilt = 'all', curCat = 'food', curSplit = 'equal', selPayer = null, selParts = new Set();
let ctMs = [], ctEmoji = '✈️', ctColor = TCOLORS[0];

// ── API CALLS ──────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    document.getElementById('api-banner').classList.remove('show');
    return await res.json();
  } catch (e) {
    document.getElementById('api-banner').classList.add('show');
    throw e;
  }
}

// ── PAGE NAV ───────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  ['trips', 'dashboard', 'reports'].forEach((x, i) => {
    if (x === id) document.querySelectorAll('.nav-tab')[i].classList.add('active');
  });
  if (id === 'reports') renderReports();
}

// ── TRIPS PAGE ─────────────────────────────────────────────
async function loadTrips() {
  try {
    trips = await api('/trips');
    renderTrips();
  } catch (e) { renderTrips(); }
}

function renderTrips() {
  const g = document.getElementById('trips-grid');
  g.innerHTML = '';
  const ntc = document.createElement('div');
  ntc.className = 'ntc';
  ntc.onclick = openCreateTrip;
  ntc.innerHTML = '<div class="nt-icon">✈️</div><div class="nt-lbl">Create New Trip</div><div class="nt-sub">Add members & split expenses</div>';
  g.appendChild(ntc);

  if (!trips.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:48px;color:var(--muted);';
    empty.innerHTML = '<div style="font-size:48px;margin-bottom:12px">🗺️</div><div style="font-size:16px;font-weight:700;margin-bottom:6px">No trips yet</div><div style="font-size:14px">Create your first trip to get started!</div>';
    g.appendChild(empty);
    return;
  }

  trips.forEach(t => {
    const isActive = activeTrip && activeTrip.id === t.id;
    const d = document.createElement('div');
    d.className = 'trip-card' + (isActive ? ' tc-active' : '');
    d.style.cursor = 'pointer';
    d.onclick = () => openTrip(t.id);
    const stk = (t.members || []).slice(0, 5).map((m, i) =>
      `<div class="av" style="background:${m.color};margin-left:${i ? '-6px' : '0'};border:2px solid #fff">${m.name[0]}</div>`
    ).join('');
    const ex = (t.members || []).length > 5
      ? `<div class="av" style="background:var(--muted2);margin-left:-6px;border:2px solid #fff;font-size:9px">+${t.members.length - 5}</div>` : '';
    const perHead = (t.members || []).length ? Math.round((t.exp_total || 0) / t.members.length).toLocaleString() : 0;
    d.innerHTML = `
      <div class="tc-banner" style="background:${t.color}">
        <div class="tc-emoji">${t.emoji}</div>
        <div class="tc-binfo"><div class="tc-name">${t.name}</div><div class="tc-dates">${t.dates || 'Dates not set'}</div></div>
        <div class="tc-status ${t.active ? 'ts-active' : 'ts-done'}">${t.active ? 'Active' : 'Settled'}</div>
      </div>
      <div class="tc-body">
        <div class="tc-avatars"><div class="av-stack">${stk}${ex}</div><span class="tc-members-n">${(t.members || []).length} members</span></div>
        <div class="tc-stats">
          <div class="tcs"><div class="tcs-v">₹${(t.exp_total || 0).toLocaleString()}</div><div class="tcs-l">Spent</div></div>
          <div class="tcs"><div class="tcs-v">${t.exp_count || 0}</div><div class="tcs-l">Expenses</div></div>
          <div class="tcs"><div class="tcs-v">₹${perHead}</div><div class="tcs-l">Per Head</div></div>
        </div>
      </div>
      <div class="tc-footer">
        <button class="btn btn-green btn-sm" onclick="openTrip(${t.id});event.stopPropagation()">Open Dashboard</button>
        ${t.active ? `<button class="btn btn-ghost btn-sm" onclick="openExpForTrip(${t.id});event.stopPropagation()">＋ Expense</button>` : ''}
        <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="deleteTrip(${t.id},'${t.name.replace(/'/g, "\\'")}');event.stopPropagation()">🗑️ Delete</button>
      </div>`;
    g.appendChild(d);
  });
}

async function openTrip(id) {
  activeTrip = trips.find(t => t.id === id);
  document.getElementById('tp').textContent = activeTrip.emoji + ' ' + activeTrip.name;
  await loadDashboard();
  showPage('dashboard');
}

async function openExpForTrip(id) {
  activeTrip = trips.find(t => t.id === id);
  document.getElementById('tp').textContent = activeTrip.emoji + ' ' + activeTrip.name;
  await loadDashboard();
  openAddExp();
}

async function deleteTrip(id, name) {
  if (!confirm('Delete "' + name + '"?\n\nThis will permanently delete the trip and all its expenses. This cannot be undone.')) return;
  await api('/trips/' + id, 'DELETE');
  if (activeTrip && activeTrip.id === id) {
    activeTrip = null;
    document.getElementById('tp').textContent = 'No trip selected';
  }
  await loadTrips();
  toast('🗑️ "' + name + '" deleted');
}

// ── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  if (!activeTrip) return;
  settleTab = 'pending';
  document.querySelectorAll('.stab').forEach((b, i) => { b.classList.toggle('stab-active', i === 0); });
  document.getElementById('dt-name').textContent = activeTrip.name;
  document.getElementById('dt-sub').textContent = (activeTrip.members || []).length + ' members · ' + (activeTrip.dates || '');
  document.getElementById('r-trip-name').textContent = activeTrip.name;

  document.getElementById('exp-list').innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  document.getElementById('settle-panel').innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  try {
    [expenses, summary] = await Promise.all([
      api('/trips/' + activeTrip.id + '/expenses'),
      api('/trips/' + activeTrip.id + '/summary')
    ]);
    const fresh = trips.find(t => t.id === activeTrip.id);
    if (fresh) activeTrip = fresh;
    renderMemBar();
    renderExpList();
    renderStats();
    renderSettle();
    renderBal();
  } catch (e) { console.error(e); }
}

function renderMemBar() {
  const bal = summary.balances || {};
  document.getElementById('mem-bar').innerHTML = (activeTrip.members || []).map(m => {
    const b = bal[m.name] || 0;
    const bc = b > 0.5 ? 'bpos' : b < -0.5 ? 'bneg' : 'bzero';
    const bv = b > 0.5 ? '+₹' + Math.abs(b).toFixed(0) : b < -0.5 ? '-₹' + Math.abs(b).toFixed(0) : '₹0';
    return `<div class="mem-chip"><div class="av" style="background:${m.color};width:22px;height:22px;font-size:10px">${m.name[0]}</div>${m.name}<span class="bal-v ${bc}">${bv}</span></div>`;
  }).join('');
}

function renderExpList() {
  const el = document.getElementById('exp-list');
  const realExp = expenses.filter(e => e.notes !== 'Settlement');
  document.getElementById('exp-badge').textContent = realExp.length;
  const f = expFilt === 'all' ? realExp : realExp.filter(e => e.category === expFilt);
  if (!f.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><h3>${expFilt === 'all' ? 'No expenses yet' : 'No ' + expFilt + ' expenses'}</h3><p>${expFilt === 'all' ? 'Add your first expense to get started' : 'Try a different filter'}</p></div>`;
    return;
  }
  el.innerHTML = f.map(e => {
    const tags = Object.entries(e.splits || {}).filter(([, v]) => v > 0).map(([n, v]) => `<span class="sp-tag">${n} ₹${parseFloat(v).toFixed(0)}</span>`).join('');
    return `<div class="ei">
      <div class="ei-icon" style="background:${CBG[e.category] || CBG.other}">${CICONS[e.category] || '📦'}</div>
      <div class="ei-info">
        <div class="ei-name">${e.name}</div>
        <div class="ei-meta">${fd(e.date)}${e.notes ? ' · ' + e.notes : ''}</div>
        <div class="ei-splits">${tags}</div>
      </div>
      <div class="ei-r">
        <div class="ei-amt">₹${parseFloat(e.amount).toLocaleString()}</div>
        <div class="ei-payer">paid by ${e.payer}</div>
        <span class="ei-cbadge cb-${e.category}">${CLBLS[e.category] || 'Other'}</span>
      </div>
      <button class="del-exp-btn" onclick="deleteExpense(${e.id})" title="Delete">🗑️</button>
    </div>`;
  }).join('');
}

function filt(c, btn) {
  expFilt = c;
  document.querySelectorAll('.cfb').forEach(b => b.classList.remove('cfa'));
  btn.classList.add('cfa');
  renderExpList();
}

function fd(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch (e) { return d; }
}

function renderStats() {
  const realExp = expenses.filter(e => e.notes !== 'Settlement');
  const tot = realExp.reduce((a, e) => a + parseFloat(e.amount), 0);
  document.getElementById('sv1').textContent = '₹' + tot.toLocaleString();
  document.getElementById('ss1').textContent = realExp.length + ' expense' + (realExp.length !== 1 ? 's' : '');

  const paid = {};
  realExp.forEach(e => paid[e.payer] = (paid[e.payer] || 0) + parseFloat(e.amount));
  let top = null, ta = 0;
  Object.entries(paid).forEach(([n, v]) => { if (v > ta) { top = n; ta = v; } });
  document.getElementById('sv4').textContent = top || '—';
  document.getElementById('ss4').textContent = top ? '₹' + ta.toLocaleString() + ' paid' : 'no payments yet';

  const s = summary.settlements || [];
  const uns = s.reduce((a, x) => a + x.amount, 0);
  document.getElementById('sv3').textContent = '₹' + Math.round(uns).toLocaleString();
  document.getElementById('ss3').textContent = s.length + ' pending';
}

let settleTab = 'pending';
function switchSettleTab(tab, btn) {
  settleTab = tab;
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('stab-active'));
  btn.classList.add('stab-active');
  renderSettle();
}

function renderSettle() {
  const el = document.getElementById('settle-panel');
  if (settleTab === 'pending') {
    const s = summary.settlements || [];
    if (!s.length) { el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px;font-weight:600">All settled up! 🎉</div>'; return; }
    el.innerHTML = s.map(x => {
      const fm = (activeTrip.members || []).find(m => m.name === x.from);
      const tm = (activeTrip.members || []).find(m => m.name === x.to);
      return `<div class="si">
        <div class="av" style="background:${fm?.color || '#999'};width:24px;height:24px;font-size:10px">${x.from[0]}</div>
        <span style="font-size:13px;font-weight:700">${x.from}</span><span class="s-arr">→</span>
        <div class="av" style="background:${tm?.color || '#999'};width:24px;height:24px;font-size:10px">${x.to[0]}</div>
        <span style="font-size:13px;font-weight:700">${x.to}</span>
        <span class="s-amt">₹${Math.round(x.amount).toLocaleString()}</span>
        <button class="btn btn-green btn-sm" style="padding:4px 10px;font-size:12px" onclick="markDone('${x.from}','${x.to}',${x.amount})">Done</button>
      </div>`;
    }).join('');
  } else {
    const history = expenses.filter(e => e.notes === 'Settlement');
    if (!history.length) { el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px;font-weight:600">No settlements recorded yet</div>'; return; }
    el.innerHTML = history.map(e => {
      const parts = e.name.split(' → ');
      const from = parts[0] || e.payer;
      const to = parts[1]?.replace(' Settlement', '') || Object.keys(e.splits || {})[0] || '?';
      const fm = (activeTrip.members || []).find(m => m.name === from);
      const tm = (activeTrip.members || []).find(m => m.name === to);
      return `<div class="sh-item">
        <div class="av" style="background:${fm?.color || '#999'};width:22px;height:22px;font-size:10px">${from[0]}</div>
        <span class="sh-from">${from}</span>
        <span class="sh-arr">→</span>
        <div class="av" style="background:${tm?.color || '#999'};width:22px;height:22px;font-size:10px">${to[0]}</div>
        <span class="sh-to">${to}</span>
        <span class="sh-amt">₹${Math.round(parseFloat(e.amount)).toLocaleString()}</span>
        <span class="sh-date">${fd(e.date)}</span>
        <button class="del-exp-btn" onclick="deleteExpense(${e.id})" title="Undo">🗑️</button>
      </div>`;
    }).join('');
  }
}

function renderBal() {
  const b = summary.balances || {};
  const el = document.getElementById('bal-panel');
  const vals = Object.values(b);
  if (!vals.length || vals.every(v => Math.abs(v) < .5)) { el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;font-weight:600">All balanced 🎉</div>'; return; }
  const mx = Math.max(...vals.map(Math.abs), 1);
  el.innerHTML = (activeTrip.members || []).map(m => {
    const v = b[m.name] || 0;
    const pct = Math.abs(v) / mx * 44;
    const cls = v > 0 ? 'bbpos' : 'bbneg';
    const col = v > .5 ? 'var(--green)' : v < -.5 ? 'var(--danger)' : 'var(--muted2)';
    const lbl = v > .5 ? '+₹' + v.toFixed(0) : v < -.5 ? '-₹' + Math.abs(v).toFixed(0) : '₹0';
    return `<div class="bbr"><div class="bbn">${m.name}</div><div class="bbt"><div class="bbc"></div><div class="bbf ${cls}" style="width:${pct}%"></div></div><div class="bbval" style="color:${col}">${lbl}</div></div>`;
  }).join('');
}

async function markDone(from, to, amount) {
  await api('/trips/' + activeTrip.id + '/expenses', 'POST', {
    name: from + ' → ' + to + ' Settlement', amount, date: new Date().toISOString().split('T')[0],
    category: 'other', payer: from, split_type: 'custom', notes: 'Settlement',
    splits: { [to]: amount }
  });
  await loadDashboard();
  toast('💰 Settlement recorded!');
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  await api('/expenses/' + id, 'DELETE');
  await loadDashboard();
  toast('🗑️ Expense deleted');
}

// ── REPORTS ────────────────────────────────────────────────
function renderReports() {
  const tripExp = expenses.filter(e => e.notes !== 'Settlement');
  const tot = tripExp.reduce((a, e) => a + parseFloat(e.amount), 0);
  document.getElementById('d-total').textContent = '₹' + tot.toLocaleString();

  const ct = {};
  tripExp.forEach(e => ct[e.category] = (ct[e.category] || 0) + parseFloat(e.amount));
  const cats = Object.entries(ct).sort((a, b) => b[1] - a[1]);
  const svg = document.getElementById('donut');
  const R = 46, circ = 2 * Math.PI * R;
  svg.innerHTML = '<circle cx="60" cy="60" r="46" fill="none" stroke="var(--border2)" stroke-width="16"/>';
  let off = 0;
  cats.forEach(([cat, val]) => {
    const frac = tot ? val / tot : 0;
    const d = frac * circ;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', R);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', CCOLS[cat] || '#999');
    c.setAttribute('stroke-width', 16);
    c.setAttribute('stroke-dasharray', `${d} ${circ - d}`);
    c.setAttribute('stroke-dashoffset', -off);
    svg.appendChild(c); off += d;
  });
  document.getElementById('cat-leg').innerHTML = cats.length
    ? cats.map(([cat, val]) => `<div class="lr"><div class="ld" style="background:${CCOLS[cat] || '#999'}"></div><span class="ll">${CLBLS[cat] || cat}</span><span class="lv">₹${val.toLocaleString()}</span><span class="lp">${tot ? ((val / tot) * 100).toFixed(0) : 0}%</span></div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;text-align:center">Add expenses to see data</div>';

  const daily = {};
  tripExp.forEach(e => { if (e.date) daily[e.date] = (daily[e.date] || 0) + parseFloat(e.amount); });
  const days = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
  const maxD = Math.max(...days.map(d => d[1]), 1);
  document.getElementById('day-bars').innerHTML = days.length
    ? days.map(([d, v]) => {
        const h = Math.max((v / maxD) * 95, 4);
        const l = fd(d);
        return `<div class="dbc"><div class="dbv">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</div><div class="dbf" style="height:${h}px"></div><div class="dbl">${l}</div></div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:13px;align-self:center;width:100%;text-align:center">No data yet</div>';

  const memberSpend = {};
  (activeTrip?.members || []).forEach(m => memberSpend[m.name] = 0);
  tripExp.forEach(e => {
    Object.entries(e.splits || {}).forEach(([member, amt]) => {
      if (member in memberSpend) memberSpend[member] += parseFloat(amt);
    });
  });
  const maxP = Math.max(...Object.values(memberSpend), 1);
  document.getElementById('per-person').innerHTML = Object.values(memberSpend).some(v => v > 0)
    ? (activeTrip?.members || []).map(m => {
        const v = memberSpend[m.name] || 0;
        const w = (v / maxP * 100).toFixed(1);
        return `<div class="pbr">
          <div class="pbn">${m.name}</div>
          <div class="pbt"><div class="pbf" style="width:${w}%;background:${m.color}40;border-right:3px solid ${m.color}"></div></div>
          <div class="pbv">₹${Math.round(v).toLocaleString()}</div>
        </div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:13px;text-align:center">No data yet</div>';
}

// ── ADD EXPENSE MODAL ──────────────────────────────────────
function openAddExp() {
  if (!activeTrip) { toast('⚠️ Open a trip first', 'err'); return; }
  curCat = 'food'; curSplit = 'equal';
  selPayer = (activeTrip.members || [])[0]?.name || null;
  selParts = new Set((activeTrip.members || []).map(m => m.name));
  document.getElementById('en').value = '';
  document.getElementById('ea').value = '';
  document.getElementById('enotes').value = '';
  document.getElementById('ed').valueAsDate = new Date();
  document.querySelectorAll('.cb').forEach(b => { b.className = 'cb'; });
  document.querySelector('[data-cat="food"]').classList.add('cb-food-s');
  document.querySelectorAll('.st-tab').forEach(t => t.classList.remove('sts'));
  document.querySelector('[data-st="equal"]').classList.add('sts');
  document.getElementById('cust-wrap').style.display = 'none';
  document.getElementById('pct-wrap').style.display = 'none';
  document.getElementById('parts-wrap').style.display = '';
  renderPayerChips(); renderPartChips(); openMO('exp-mo');
}

function renderPayerChips() {
  document.getElementById('payer-chips').innerHTML = (activeTrip.members || []).map(m =>
    `<div class="pchip ${selPayer === m.name ? 'ps' : ''}" onclick="pickPayer('${m.name}')"><div class="av" style="background:${m.color};width:22px;height:22px;font-size:10px">${m.name[0]}</div>${m.name}</div>`
  ).join('');
}
function pickPayer(n) { selPayer = n; renderPayerChips(); }

function renderPartChips() {
  document.getElementById('part-chips').innerHTML = (activeTrip.members || []).map(m =>
    `<div class="ptchip ${selParts.has(m.name) ? 'pts' : ''}" onclick="togPart('${m.name}')"><div class="av" style="background:${m.color};width:22px;height:22px;font-size:10px">${m.name[0]}</div>${m.name}</div>`
  ).join('');
  if (curSplit === 'custom') buildCustRows();
  if (curSplit === 'pct') buildPctRows();
}
function togPart(n) { if (selParts.has(n)) { if (selParts.size > 1) selParts.delete(n); } else selParts.add(n); renderPartChips(); }

function pickCat(c) {
  curCat = c;
  document.querySelectorAll('.cb').forEach(b => { b.className = 'cb'; });
  document.querySelector('[data-cat="' + c + '"]').classList.add('cb-' + c + '-s');
}

function pickSplit(t) {
  curSplit = t;
  document.querySelectorAll('.st-tab').forEach(x => x.classList.remove('sts'));
  document.querySelector('[data-st="' + t + '"]').classList.add('sts');
  document.getElementById('cust-wrap').style.display = t === 'custom' ? '' : 'none';
  document.getElementById('pct-wrap').style.display = t === 'pct' ? '' : 'none';
  document.getElementById('parts-wrap').style.display = t === 'pct' ? 'none' : '';
  if (t === 'custom') buildCustRows();
  if (t === 'pct') buildPctRows();
}
function onAmt() { if (curSplit === 'custom') buildCustRows(); if (curSplit === 'pct') updPct(); }

function buildCustRows() {
  const amt = parseFloat(document.getElementById('ea').value) || 0;
  const ms = activeTrip.members || [];
  const per = ms.length ? amt / ms.length : 0;
  document.getElementById('cust-rows').innerHTML = ms.map(m =>
    `<div class="cstr"><div class="cstp"><div class="av" style="background:${m.color};width:24px;height:24px;font-size:10px">${m.name[0]}</div>${m.name}</div><div style="text-align:right"><input type="number" class="csti" id="ci-${m.name}" value="${per.toFixed(2)}" min="0" oninput="updCust()"></div><div class="csths" id="cs-${m.name}">${amt ? ((per / amt) * 100).toFixed(1) : 0}%</div></div>`
  ).join('');
  updCust();
}
function updCust() {
  const tot = parseFloat(document.getElementById('ea').value) || 0;
  let asgn = 0;
  (activeTrip.members || []).forEach(function (m) {
    const inp = document.getElementById('ci-' + m.name);
    const v = inp ? parseFloat(inp.value) || 0 : 0;
    asgn += v;
    const el = document.getElementById('cs-' + m.name);
    if (el) el.textContent = tot ? ((v / tot) * 100).toFixed(1) + '%' : '0%';
  });
  document.getElementById('csumv').textContent = '₹' + asgn.toFixed(0) + ' / ₹' + tot.toFixed(0);
  document.getElementById('cw').style.display = Math.abs(asgn - tot) > 0.5 ? 'block' : 'none';
}

function buildPctRows() {
  const amt = parseFloat(document.getElementById('ea').value) || 0;
  const ms = activeTrip.members || [];
  const per = (100 / ms.length).toFixed(1);
  document.getElementById('pct-rows').innerHTML = ms.map(m =>
    `<div class="cstr"><div class="cstp"><div class="av" style="background:${m.color};width:24px;height:24px;font-size:10px">${m.name[0]}</div>${m.name}</div><div style="text-align:right"><input type="number" class="csti" id="pi-${m.name}" value="${per}" max="100" min="0" oninput="updPct()"></div><div class="csths" id="pa-${m.name}">₹${(amt * per / 100).toFixed(0)}</div></div>`
  ).join('');
  updPct();
}
function updPct() {
  const amt = parseFloat(document.getElementById('ea').value) || 0;
  let tot = 0;
  (activeTrip.members || []).forEach(function (m) {
    const inp = document.getElementById('pi-' + m.name);
    const v = inp ? parseFloat(inp.value) || 0 : 0;
    tot += v;
    const el = document.getElementById('pa-' + m.name);
    if (el) el.textContent = '₹' + (amt * v / 100).toFixed(0);
  });
  document.getElementById('psumv').textContent = tot.toFixed(1) + '%';
  document.getElementById('pw').style.display = Math.abs(tot - 100) > 0.5 ? 'block' : 'none';
}

async function submitExp() {
  const name = document.getElementById('en').value.trim();
  const amount = parseFloat(document.getElementById('ea').value);
  const date = document.getElementById('ed').value;
  const notes = document.getElementById('enotes').value.trim();
  if (!name) { document.getElementById('en').focus(); return; }
  if (!amount || amount <= 0) { document.getElementById('ea').focus(); return; }
  if (!selPayer) { toast('⚠️ Select who paid', 'err'); return; }

  let splits = {};
  if (curSplit === 'equal') {
    const ps = [...selParts]; const per = amount / ps.length;
    ps.forEach(p => splits[p] = per);
  } else if (curSplit === 'custom') {
    let assigned = 0;
    (activeTrip.members || []).forEach(function (m) {
      const inp = document.getElementById('ci-' + m.name);
      const v = inp ? parseFloat(inp.value) || 0 : 0;
      splits[m.name] = v; assigned += v;
    });
    if (Math.abs(assigned - amount) > 0.5) { toast('⚠️ Custom amounts must add up to ₹' + amount.toFixed(0), 'err'); return; }
  } else {
    let totalPct = 0;
    (activeTrip.members || []).forEach(function (m) {
      const inp = document.getElementById('pi-' + m.name);
      const pct = inp ? parseFloat(inp.value) || 0 : 0;
      splits[m.name] = amount * pct / 100; totalPct += pct;
    });
    if (Math.abs(totalPct - 100) > 0.5) { toast('⚠️ Percentages must add up to 100%', 'err'); return; }
  }

  const btn = document.getElementById('save-exp-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    await api('/trips/' + activeTrip.id + '/expenses', 'POST', { name, amount, date, notes, category: curCat, payer: selPayer, split_type: curSplit, splits });
    closeMO('exp-mo');
    await loadDashboard();
    await loadTrips();
    toast('✅ ' + name + ' added!');
  } catch (e) { toast('❌ Failed to save expense', 'err'); }
  finally { btn.textContent = 'Add Expense'; btn.disabled = false; }
}

// ── CREATE TRIP MODAL ──────────────────────────────────────
function openCreateTrip() {
  ctMs = []; ctEmoji = '✈️'; ctColor = TCOLORS[0];
  document.getElementById('ctn').value = '';
  document.getElementById('cts').valueAsDate = new Date();
  document.getElementById('cte').valueAsDate = new Date(Date.now() + 6 * 86400000);
  document.getElementById('ct-minp').value = '';
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(e => `<div class="emb ${e === ctEmoji ? 'es' : ''}" onclick="pickEmoji('${e}')">${e}</div>`).join('');
  document.getElementById('color-grid').innerHTML = TCOLORS.map((c, i) => `<div class="clb ${i === 0 ? 'cls' : ''}" style="background:${TCOLPREV[i]}" onclick="pickColor(${i})"></div>`).join('');
  renderCtMembers(); openMO('ct-mo');
}
function pickEmoji(e) { ctEmoji = e; document.querySelectorAll('.emb').forEach(b => { b.classList.remove('es'); if (b.textContent === e) b.classList.add('es'); }); }
function pickColor(i) { ctColor = TCOLORS[i]; document.querySelectorAll('.clb').forEach((b, j) => b.classList.toggle('cls', j === i)); }
function renderCtMembers() {
  document.getElementById('ct-mlist').innerHTML = ctMs.map((m, i) =>
    `<div class="tmlr"><div class="av" style="background:${m.color};width:26px;height:26px">${m.name[0]}</div><div class="tmlrn">${m.name}</div><button class="rmbtn" onclick="ctRm(${i})">✕</button></div>`
  ).join('');
}
function ctAdd() { const inp = document.getElementById('ct-minp'); const n = inp.value.trim(); if (!n) return; ctMs.push({ name: n, color: AVCOLS[ctMs.length % AVCOLS.length] }); inp.value = ''; renderCtMembers(); }
function ctRm(i) { ctMs.splice(i, 1); renderCtMembers(); }

async function submitTrip() {
  const name = document.getElementById('ctn').value.trim();
  if (!name) { document.getElementById('ctn').focus(); return; }
  if (ctMs.length === 0) { toast('⚠️ Add at least one member', 'err'); return; }
  const s = document.getElementById('cts').value, e = document.getElementById('cte').value;
  const dates = s && e ? fd(s) + ' – ' + fd(e) : 'Dates TBD';
  const btn = document.getElementById('save-trip-btn');
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    await api('/trips', 'POST', { name, emoji: ctEmoji, color: ctColor, dates, members: ctMs });
    closeMO('ct-mo');
    await loadTrips();
    toast('🗺️ ' + name + ' created!');
  } catch (e) { toast('❌ Failed to create trip', 'err'); }
  finally { btn.textContent = 'Create Trip'; btn.disabled = false; }
}

// ── MEMBERS MODAL ──────────────────────────────────────────
function openMemModal() { renderMemList(); openMO('mem-mo'); }
function renderMemList() {
  document.getElementById('mem-list').innerHTML = (activeTrip.members || []).map((m, i) =>
    `<div class="tmlr"><div class="av" style="background:${m.color};width:26px;height:26px">${m.name[0]}</div><div class="tmlrn">${m.name}</div><button class="rmbtn" onclick="rmMem(${m.id})">✕</button></div>`
  ).join('');
}
async function addMem() {
  const inp = document.getElementById('nm-inp');
  const n = inp.value.trim(); if (!n) return;
  const color = AVCOLS[(activeTrip.members || []).length % AVCOLS.length];
  await api('/trips/' + activeTrip.id + '/members', 'POST', { name: n, color });
  inp.value = '';
  await loadTrips();
  activeTrip = trips.find(t => t.id === activeTrip.id);
  renderMemList(); renderMemBar(); toast('👤 ' + n + ' added!');
}
async function rmMem(memberId) {
  await api('/members/' + memberId, 'DELETE');
  await loadTrips();
  activeTrip = trips.find(t => t.id === activeTrip.id);
  renderMemList(); renderMemBar(); toast('👤 Member removed');
}

// ── MODAL HELPERS ──────────────────────────────────────────
function openMO(id) { document.getElementById(id).classList.add('open'); }
function closeMO(id, e) { if (e && e.target !== document.getElementById(id)) return; document.getElementById(id).classList.remove('open'); }

// ── TOAST ──────────────────────────────────────────────────
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  document.getElementById('tm').textContent = msg;
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.style.borderLeftColor = type === 'err' ? 'var(--danger)' : 'var(--green)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── INIT ───────────────────────────────────────────────────
loadTrips();
