// ---------- Storage ----------
const STORE_ENTRIES = 'wt_entries';
const STORE_GOAL = 'wt_goal';
const STORE_UNIT = 'wt_unit';

function loadEntries(){
  const raw = localStorage.getItem(STORE_ENTRIES);
  return raw ? JSON.parse(raw) : [];
}
function saveEntries(entries){
  localStorage.setItem(STORE_ENTRIES, JSON.stringify(entries));
}
function loadGoal(){
  const raw = localStorage.getItem(STORE_GOAL);
  return raw ? JSON.parse(raw) : null;
}
function saveGoal(goal){
  localStorage.setItem(STORE_GOAL, JSON.stringify(goal));
}
function loadUnit(){
  return localStorage.getItem(STORE_UNIT) || 'kg';
}
function saveUnit(u){
  localStorage.setItem(STORE_UNIT, u);
}

let entries = loadEntries();
let goal = loadGoal();
let unit = loadUnit();

// ---------- Seed sample data on first run ----------
if(entries.length === 0 && localStorage.getItem('wt_seeded') === null){
  const today = new Date();
  const sample = [75.8,75.5,75.3,75.1,74.9,74.8,74.6,74.5,74.2,74.0,73.9,73.7,73.6,73.4,73.3,73.1,73.0,72.9,72.7,72.4];
  sample.reverse().forEach((w,i)=>{
    const d = new Date(today);
    d.setDate(d.getDate() - (sample.length - 1 - i));
    entries.push({ id: cryptoId(), date: d.toISOString().slice(0,10), weight: w, note: '' });
  });
  saveEntries(entries);
  saveGoal({ start: 75.8, target: 68.0, date: (()=>{ const d=new Date(today); d.setMonth(d.getMonth()+3); return d.toISOString().slice(0,10); })() });
  goal = loadGoal();
  localStorage.setItem('wt_seeded','1');
}

function cryptoId(){
  return 'e' + Math.random().toString(36).slice(2,10);
}

function fmt(num){
  return (Math.round(num*10)/10).toFixed(1);
}
function sortedEntries(){
  return [...entries].sort((a,b)=> a.date.localeCompare(b.date));
}

// ---------- View switching ----------
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if(btn.dataset.view === 'trends') renderBigChart(bigChartRange);
  });
});

// ---------- Modal ----------
const modalBackdrop = document.getElementById('modalBackdrop');
document.getElementById('openLogModal').addEventListener('click', ()=>{
  document.getElementById('entryDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('logError').textContent = '';
  document.getElementById('logForm').reset();
  document.getElementById('entryDate').value = new Date().toISOString().slice(0,10);
  modalBackdrop.classList.add('open');
});
document.getElementById('closeModal').addEventListener('click', ()=> modalBackdrop.classList.remove('open'));
modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) modalBackdrop.classList.remove('open'); });

document.getElementById('logForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const date = document.getElementById('entryDate').value;
  const weightRaw = parseFloat(document.getElementById('entryWeight').value);
  const note = document.getElementById('entryNote').value.trim();
  const errorEl = document.getElementById('logError');

  if(!date){ errorEl.textContent = 'Pick a date.'; return; }
  if(isNaN(weightRaw) || weightRaw <= 0){ errorEl.textContent = 'Enter a valid weight.'; return; }

  const weightKg = unit === 'lb' ? weightRaw / 2.20462 : weightRaw;

  const existing = entries.find(en => en.date === date);
  if(existing){
    existing.weight = weightKg;
    existing.note = note;
  } else {
    entries.push({ id: cryptoId(), date, weight: weightKg, note });
  }
  saveEntries(entries);
  errorEl.textContent = '';
  modalBackdrop.classList.remove('open');
  renderAll();
});

// ---------- Unit toggle ----------
const unitToggle = document.getElementById('unitToggle');
unitToggle.value = unit;
document.getElementById('unitLabel').textContent = unit;
unitToggle.addEventListener('change', ()=>{
  unit = unitToggle.value;
  saveUnit(unit);
  document.getElementById('unitLabel').textContent = unit;
  renderAll();
});
function displayWeight(kg){
  const v = unit === 'lb' ? kg * 2.20462 : kg;
  return fmt(v) + ' ' + unit;
}

// ---------- Goal form ----------
if(goal){
  document.getElementById('startWeight').value = goal.start;
  document.getElementById('goalWeight').value = goal.target;
  document.getElementById('goalDate').value = goal.date;
}
document.getElementById('goalForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const start = parseFloat(document.getElementById('startWeight').value);
  const target = parseFloat(document.getElementById('goalWeight').value);
  const date = document.getElementById('goalDate').value;
  if(isNaN(start) || isNaN(target) || !date) return;
  goal = { start, target, date };
  saveGoal(goal);
  renderAll();
});

// ---------- Render: Overview stats ----------
function renderStats(){
  const se = sortedEntries();
  const current = se.length ? se[se.length-1].weight : null;

  document.getElementById('statCurrent').textContent = current !== null ? displayWeight(current) : '—';
  document.getElementById('statGoal').textContent = goal ? displayWeight(goal.target) : 'Not set';
  document.getElementById('statRemaining').textContent = (goal && current !== null) ? displayWeight(Math.abs(current - goal.target)) : '—';

  // this week's change: compare current to entry ~7 days ago
  let weekChangeText = '—';
  if(se.length >= 2){
    const now = new Date(se[se.length-1].date);
    const weekAgoTarget = new Date(now); weekAgoTarget.setDate(weekAgoTarget.getDate()-7);
    let closest = se[0];
    se.forEach(en=>{
      if(new Date(en.date) <= weekAgoTarget) closest = en;
    });
    const delta = current - closest.weight;
    weekChangeText = (delta <= 0 ? '' : '+') + displayWeight(delta).replace(unit,'').trim() + ' ' + unit;
  }
  document.getElementById('statWeek').textContent = weekChangeText;
}

// ---------- Render: progress bars ----------
function renderProgress(){
  const se = sortedEntries();
  const current = se.length ? se[se.length-1].weight : null;
  const weeklyFill = document.getElementById('weeklyFill');
  const overallFill = document.getElementById('overallFill');
  const weeklyCaption = document.getElementById('weeklyCaption');
  const overallCaption = document.getElementById('overallCaption');

  if(!goal || current === null){
    weeklyFill.style.width = '0%';
    overallFill.style.width = '0%';
    weeklyCaption.textContent = 'Set a goal to see pace.';
    overallCaption.textContent = 'Set a goal to see overall progress.';
    return;
  }

  const totalToLose = goal.start - goal.target;
  const lostSoFar = goal.start - current;
  const overallPct = totalToLose !== 0 ? Math.max(0, Math.min(100, (lostSoFar/totalToLose)*100)) : 0;
  overallFill.style.width = overallPct + '%';
  overallCaption.textContent = `${fmt(Math.max(0,lostSoFar))} of ${fmt(Math.abs(totalToLose))} ${unit === 'lb' ? 'lb' : 'kg'} ${totalToLose>=0?'lost':'gained'}`;

  // weekly pace: target weekly loss based on days remaining
  const today = new Date(se[se.length-1].date);
  const target = new Date(goal.date);
  const weeksRemaining = Math.max(1, (target - today) / (1000*60*60*24*7));
  const remainingToLose = current - goal.target;
  const targetWeeklyRate = remainingToLose / weeksRemaining;

  const weekAgoTarget = new Date(today); weekAgoTarget.setDate(weekAgoTarget.getDate()-7);
  let closest = se[0];
  se.forEach(en=>{ if(new Date(en.date) <= weekAgoTarget) closest = en; });
  const actualWeekly = closest.weight - current;

  const pacePct = targetWeeklyRate !== 0 ? Math.max(0, Math.min(100, (actualWeekly/targetWeeklyRate)*100)) : 0;
  weeklyFill.style.width = pacePct + '%';
  weeklyCaption.textContent = `Target: ${fmt(Math.abs(targetWeeklyRate))} ${unit}/week — logged ${fmt(Math.abs(actualWeekly))} ${unit} this week`;
}

// ---------- Render: week strip ----------
function renderWeekStrip(){
  const wrap = document.getElementById('weekStrip');
  wrap.innerHTML = '';
  const days = ['M','T','W','T','F','S','S'];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);

  let loggedCount = 0;
  for(let i=0;i<7;i++){
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    const key = d.toISOString().slice(0,10);
    const hasEntry = entries.some(en=>en.date===key);
    if(hasEntry) loggedCount++;
    const col = document.createElement('div');
    col.innerHTML = `<p class="week-day-label">${days[i]}</p><div class="week-bar-wrap"><div class="week-bar${hasEntry?' logged':''}" style="height:${hasEntry ? '100%':'20%'}"></div></div>`;
    wrap.appendChild(col);
  }
  document.getElementById('weekLoggedNote').textContent = `${loggedCount} of 7 days logged`;
}

// ---------- Render: recent entries + history table ----------
function renderEntryLists(){
  const se = [...sortedEntries()].reverse();
  const recentWrap = document.getElementById('recentEntries');
  recentWrap.innerHTML = '';
  se.slice(0,5).forEach(en=>{
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `<span class="entry-date">${niceDate(en.date)}</span><span class="weight-val">${displayWeight(en.weight)}</span>`;
    recentWrap.appendChild(row);
  });

  const histBody = document.getElementById('historyBody');
  histBody.innerHTML = '';
  document.getElementById('emptyHistoryNote').style.display = se.length ? 'none' : 'block';
  se.forEach(en=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${niceDate(en.date)}</td>
      <td class="weight-val">${displayWeight(en.weight)}</td>
      <td>${en.note ? escapeHtml(en.note) : '<span class="muted-note">—</span>'}</td>
      <td><div class="row-actions">
        <button class="edit-btn" data-id="${en.id}" aria-label="Edit"><i class="ti ti-edit"></i></button>
        <button class="del-btn" data-id="${en.id}" aria-label="Delete"><i class="ti ti-trash"></i></button>
      </div></td>`;
    histBody.appendChild(tr);
  });

  histBody.querySelectorAll('.del-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      entries = entries.filter(en=>en.id !== b.dataset.id);
      saveEntries(entries);
      renderAll();
    });
  });
  histBody.querySelectorAll('.edit-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const en = entries.find(x=>x.id===b.dataset.id);
      if(!en) return;
      document.getElementById('entryDate').value = en.date;
      document.getElementById('entryWeight').value = unit==='lb' ? fmt(en.weight*2.20462) : fmt(en.weight);
      document.getElementById('entryNote').value = en.note || '';
      document.getElementById('logError').textContent = '';
      modalBackdrop.classList.add('open');
    });
  });
}

function niceDate(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}
function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ---------- Charts ----------
let trendChart, bigChart;
let overviewRange = 30;
let bigChartRange = 30;

function filteredByRange(range){
  const se = sortedEntries();
  if(range === 'all') return se;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(range));
  return se.filter(en => new Date(en.date) >= cutoff);
}

function chartConfig(data){
  const labels = data.map(en => niceDate(en.date));
  const values = data.map(en => unit==='lb' ? en.weight*2.20462 : en.weight);
  const datasets = [{
    label: 'Weight',
    data: values,
    borderColor: '#2F6F5E',
    backgroundColor: 'rgba(47,111,94,0.08)',
    borderWidth: 2.5,
    pointRadius: 2,
    tension: 0.3,
    fill: true,
  }];
  if(goal){
    const goalVal = unit==='lb' ? goal.target*2.20462 : goal.target;
    datasets.push({
      label: 'Goal',
      data: labels.map(()=>goalVal),
      borderColor: '#C97B4A',
      borderDash: [5,5],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: {
        x: { grid: { display:false }, ticks: { font: { size: 11 }, maxTicksLimit: 8 } },
        y: { grid: { color:'#E4E1D8' }, ticks: { font: { size: 11 } } }
      }
    }
  };
}

function renderTrendChart(range){
  const data = filteredByRange(range);
  const ctx = document.getElementById('trendChart');
  if(trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, chartConfig(data));
}
function renderBigChart(range){
  const data = filteredByRange(range);
  const ctx = document.getElementById('bigTrendChart');
  if(bigChart) bigChart.destroy();
  bigChart = new Chart(ctx, chartConfig(data));
}

document.querySelectorAll('.range-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.range-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    overviewRange = b.dataset.range;
    renderTrendChart(overviewRange);
  });
});
document.querySelectorAll('.range-btn2').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.range-btn2').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    bigChartRange = b.dataset.range2;
    renderBigChart(bigChartRange);
  });
});

// ---------- Trends page stats ----------
function renderTrendStats(){
  const se = sortedEntries();
  if(se.length < 2){
    document.getElementById('avgWeekly').textContent = '—';
    document.getElementById('lowestLogged').textContent = se.length ? displayWeight(se[0].weight) : '—';
    document.getElementById('highestLogged').textContent = se.length ? displayWeight(se[0].weight) : '—';
    document.getElementById('streakVal').textContent = se.length ? '1 day' : '0 days';
    return;
  }
  const first = se[0], last = se[se.length-1];
  const totalWeeks = Math.max(1, (new Date(last.date) - new Date(first.date)) / (1000*60*60*24*7));
  const avgWeekly = (first.weight - last.weight) / totalWeeks;
  document.getElementById('avgWeekly').textContent = (avgWeekly>=0?'-':'+') + fmt(Math.abs(avgWeekly)) + ' ' + unit;

  const weights = se.map(e=>e.weight);
  document.getElementById('lowestLogged').textContent = displayWeight(Math.min(...weights));
  document.getElementById('highestLogged').textContent = displayWeight(Math.max(...weights));

  // streak: consecutive days ending today with an entry
  let streak = 0;
  let cursor = new Date();
  while(true){
    const key = cursor.toISOString().slice(0,10);
    if(entries.some(en=>en.date===key)){
      streak++;
      cursor.setDate(cursor.getDate()-1);
    } else break;
  }
  document.getElementById('streakVal').textContent = streak + (streak===1 ? ' day' : ' days');
}

// ---------- Goal summary ----------
function renderGoalSummary(){
  const panel = document.getElementById('goalSummaryPanel');
  if(!goal){ panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const se = sortedEntries();
  const current = se.length ? se[se.length-1].weight : goal.start;
  const remaining = current - goal.target;
  const totalToLose = goal.start - goal.target;
  const lostSoFar = goal.start - current;
  const pct = totalToLose !== 0 ? Math.max(0, Math.min(100,(lostSoFar/totalToLose)*100)) : 0;
  document.getElementById('goalOverallFill').style.width = pct + '%';

  const daysLeft = Math.round((new Date(goal.date) - new Date()) / (1000*60*60*24));
  document.getElementById('goalSummaryText').textContent =
    remaining > 0
      ? `You're ${fmt(Math.abs(remaining))} ${unit} away from ${fmt(unit==='lb'?goal.target*2.20462:goal.target)} ${unit}, with ${daysLeft > 0 ? daysLeft + ' days left' : 'the target date passed'}.`
      : `You've reached your goal weight. Nice work.`;
}

// ---------- Master render ----------
function renderAll(){
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
  renderStats();
  renderProgress();
  renderWeekStrip();
  renderEntryLists();
  renderTrendChart(overviewRange);
  renderTrendStats();
  renderGoalSummary();
}

renderAll();
