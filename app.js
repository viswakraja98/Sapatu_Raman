import { makeBackend, uid, TABLES, getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from './db.js';
import { CHARTS } from './charts.js';
import { DEFAULT_PROFILES, SEED_RECIPES } from './seed.js';
import { groceriesFromText, groceriesFromIngredients, AISLES } from './groceries.js';

// ---------- constants ----------
const SLOTS = [
  { name: 'Early morning', time: '7:00 AM', icon: '💧', share: 0.03 },
  { name: 'Breakfast', time: '8:30 AM', icon: '🍳', share: 0.22 },
  { name: 'Mid-morning', time: '11:00 AM', icon: '🍎', share: 0.10 },
  { name: 'Lunch', time: '1:00 PM', icon: '🍛', share: 0.30 },
  { name: 'Evening snack', time: '4:30 PM', icon: '☕', share: 0.10 },
  { name: 'Dinner', time: '7:00 PM', icon: '🥗', share: 0.25 },
];
// Rough per-slot calorie estimates for the diet-chart meals (the PDFs don't list calories).
const CHART_KCAL = [40, 300, 130, 420, 150, 330];
const SLOT_CATS = [['drink'], ['breakfast'], ['snack', 'drink'], ['lunch'], ['snack', 'drink'], ['dinner']];
const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'side'];
const STATUS = {
  planned: { label: 'Planned', cls: '' },
  done: { label: 'Done', cls: 'ok' },
  changed: { label: 'Changed', cls: 'chg' },
  skipped: { label: 'Skipped', cls: 'skip' },
};
const COLORS = ['#2f855a', '#b83280', '#c05621', '#2b6cb0', '#6b46c1', '#c53030', '#2c7a7b', '#975a16'];

// ---------- tiny helpers ----------
const $ = sel => document.querySelector(sel);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => parseISO(s).toLocaleDateString(undefined, opts);
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const kc = n => (n == null ? '–' : Math.round(n).toLocaleString());
const nowIso = () => new Date().toISOString();
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

// ---------- state ----------
const backend = makeBackend();
const state = {
  data: { profiles: [], recipes: [], plan_items: [], weights: [] },
  me: safeGet('fdp-me'),
  viewing: null,
  date: today(),
  recipeQuery: '',
  recipeCat: 'all',
  syncing: false,
};

const profileById = id => state.data.profiles.find(p => p.id === id);
const recipeById = id => state.data.recipes.find(r => r.id === id);
const profilesSorted = () => [...state.data.profiles].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
const itemsFor = (pid, date) => state.data.plan_items.filter(i => i.profile_id === pid && i.date === date)
  .sort((a, b) => a.slot - b.slot || (a.sort ?? 0) - (b.sort ?? 0));

function eatenKcal(i) {
  if (i.status === 'done') return i.kcal || 0;
  if (i.status === 'changed') return i.actual_kcal ?? i.kcal ?? 0;
  return 0;
}
function dayStats(pid, date) {
  const items = itemsFor(pid, date);
  const planned = items.reduce((s, i) => s + (i.kcal || 0), 0);
  const eaten = items.reduce((s, i) => s + eatenKcal(i), 0);
  const logged = items.filter(i => i.status && i.status !== 'planned').length;
  const done = items.filter(i => i.status === 'done').length;
  const changed = items.filter(i => i.status === 'changed').length;
  const skipped = items.filter(i => i.status === 'skipped').length;
  return { items, planned, eaten, logged, done, changed, skipped, total: items.length };
}
function rangeStats(pid, days) {
  let done = 0, logged = 0, kcalSum = 0, kcalDays = 0;
  for (let k = 0; k < days; k++) {
    const s = dayStats(pid, addDays(today(), -k));
    done += s.done; logged += s.logged;
    if (s.logged) { kcalSum += s.eaten; kcalDays++; }
  }
  return { onPlan: logged ? Math.round((done / logged) * 100) : null, avgKcal: kcalDays ? kcalSum / kcalDays : null, daysLogged: kcalDays };
}
function streak(pid) {
  let n = 0; let d = today();
  if (!dayStats(pid, d).logged) d = addDays(d, -1); // today not logged yet doesn't break the streak
  while (dayStats(pid, d).logged) { n++; d = addDays(d, -1); }
  return n;
}
function weightsFor(pid) { return state.data.weights.filter(w => w.profile_id === pid).sort((a, b) => a.date.localeCompare(b.date)); }
function chartDayFor(p, date) {
  if (!p?.plan_start) return null;
  const diff = Math.round((parseISO(date) - parseISO(p.plan_start)) / 864e5);
  if (diff < 0 || diff >= CHARTS.length * 7) return null;
  return { week: Math.floor(diff / 7) + 1, day: (diff % 7) + 1 };
}

// ---------- persistence ----------
async function save(table, rows) {
  rows = [].concat(rows).map(r => ({ ...r, updated_at: nowIso() }));
  for (const row of rows) {
    const arr = state.data[table]; const i = arr.findIndex(r => r.id === row.id);
    if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push(row);
  }
  render();
  try { await backend.upsert(table, rows); } catch (e) { toast('Could not save: ' + (e.message || e)); await reload(); }
}
async function del(table, ids) {
  const set = new Set([].concat(ids));
  state.data[table] = state.data[table].filter(r => !set.has(r.id));
  render();
  try { await backend.remove(table, [...set]); } catch (e) { toast('Could not delete: ' + (e.message || e)); await reload(); }
}
async function reload() {
  try {
    state.syncing = true;
    const d = await backend.loadAll();
    TABLES.forEach(t => (state.data[t] = d[t] || []));
    state.loadError = null;
  } catch (e) { state.loadError = e.message || String(e); toast('Could not load data: ' + state.loadError); }
  state.syncing = false;
  render();
}
async function seedIfEmpty() {
  if (!state.data.profiles.length) {
    await backend.upsert('profiles', DEFAULT_PROFILES.map((p, i) => ({ id: uid(), sort: i, ...p, created_at: nowIso(), updated_at: nowIso() })));
  }
  if (!state.data.recipes.length) {
    await backend.upsert('recipes', SEED_RECIPES.map(r => ({ id: uid(), ...r, created_at: nowIso(), updated_at: nowIso() })));
  }
}

// ---------- UI shell ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function route() { return (location.hash.replace(/^#\/?/, '') || 'day').split('/'); }
function go(path) { location.hash = '#/' + path; }

function sheet(title, body, { onClose } = {}) {
  const dlg = h('dialog', { class: 'sheet' },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('div', { class: 'sheet-body' }, body));
  dlg.addEventListener('close', () => { dlg.remove(); onClose && onClose(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg); dlg.showModal();
  return dlg;
}
function field(label, input, hint) { return h('label', { class: 'field' }, h('span', {}, label), input, hint && h('small', {}, hint)); }

function render() {
  const app = $('#app');
  const [page, arg] = route();
  if (!state.data.profiles.length) {
    if (state.loadError && !state.syncing) {
      app.replaceChildren(h('div', { class: 'page center' }, h('section', { class: 'card login' },
        h('h1', {}, 'Database not ready'),
        h('p', {}, 'The app signed in but couldn’t read or create its data. Usually this means schema.sql hasn’t been run in the Supabase SQL Editor yet.'),
        h('p', { class: 'error small' }, state.loadError),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Try again'),
          backend.kind === 'supabase' && h('button', { class: 'btn', onclick: async () => { await backend.signOut(); location.reload(); } }, 'Sign out')))));
      return;
    }
    app.replaceChildren(h('div', { class: 'empty' }, state.syncing ? 'Loading…' : 'Setting up…')); return;
  }
  if (!state.me || !profileById(state.me)) { app.replaceChildren(whoAreYou()); return; }
  if (!state.viewing || !profileById(state.viewing)) state.viewing = state.me;

  let view;
  if (page === 'recipes') view = recipesView();
  else if (page === 'family') view = familyView();
  else if (page === 'profile' && profileById(arg)) view = profileView(profileById(arg));
  else if (page === 'settings') view = settingsView();
  else view = dayView();

  const tab = (id, icon, label) => h('a', { href: '#/' + id, class: 'tab' + ((page === id || (id === 'day' && !['recipes', 'family', 'profile', 'settings'].includes(page)) || (id === 'family' && page === 'profile')) ? ' active' : '') }, h('span', { class: 'tab-icon' }, icon), label);
  app.replaceChildren(
    h('main', { class: 'page' }, view),
    h('nav', { class: 'tabs' }, tab('day', '📅', 'Plan'), tab('recipes', '📖', 'Recipes'), tab('family', '👪', 'Family'), tab('settings', '⚙️', 'Settings')),
  );
}

function avatar(p, size = '') { return h('span', { class: 'avatar ' + size, style: { background: p.color || '#2f855a' } }, p.emoji || p.name[0]); }

function whoAreYou() {
  return h('div', { class: 'page center' },
    h('h1', {}, 'Who’s using this phone?'),
    h('p', { class: 'muted' }, 'Pick your profile. You can still see and update everyone’s plans.'),
    h('div', { class: 'who-list' }, profilesSorted().map(p => h('button', {
      class: 'who', onclick: () => { state.me = p.id; state.viewing = p.id; safeSet('fdp-me', p.id); render(); },
    }, avatar(p, 'lg'), h('span', {}, p.name)))),
    h('p', { class: 'muted small' }, 'Names can be changed under Family.'));
}

// ---------- Day / plan view ----------
function dayView() {
  const p = profileById(state.viewing);
  const s = dayStats(p.id, state.date);
  const goal = p.calorie_goal || 0;
  const pct = goal ? Math.min(100, (s.eaten / goal) * 100) : 0;
  const plannedPct = goal ? Math.min(100, (s.planned / goal) * 100) : 0;
  const chartDay = chartDayFor(p, state.date);
  const isToday = state.date === today();

  const week = [];
  const start = addDays(state.date, -3);
  for (let k = 0; k < 7; k++) {
    const d = addDays(start, k); const st = dayStats(p.id, d);
    week.push(h('button', { class: 'wd' + (d === state.date ? ' sel' : '') + (d === today() ? ' today' : ''), onclick: () => { state.date = d; render(); } },
      h('span', { class: 'wd-name' }, fmtDate(d, { weekday: 'narrow' })),
      h('span', { class: 'wd-num' }, parseISO(d).getDate()),
      h('span', { class: 'dot ' + (st.total ? (st.logged === st.total ? 'full' : st.logged ? 'part' : 'plan') : '') })));
  }

  const remaining = goal - s.planned;
  return h('div', {},
    h('header', { class: 'top' },
      h('div', { class: 'people' }, profilesSorted().map(q => h('button', {
        class: 'person' + (q.id === p.id ? ' sel' : ''), style: { '--c': q.color }, onclick: () => { state.viewing = q.id; render(); },
      }, avatar(q, 'sm'), q.id === state.me ? 'Me' : q.name))),
    ),
    h('div', { class: 'week' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous week', onclick: () => { state.date = addDays(state.date, -7); render(); } }, '‹'),
      h('div', { class: 'wds' }, week),
      h('button', { class: 'icon-btn', 'aria-label': 'Next week', onclick: () => { state.date = addDays(state.date, 7); render(); } }, '›')),
    h('div', { class: 'day-title' },
      h('h1', {}, isToday ? 'Today' : fmtDate(state.date, { weekday: 'long' }), h('span', { class: 'muted' }, ' · ' + fmtDate(state.date, { day: 'numeric', month: 'long' }))),
      !isToday && h('button', { class: 'link', onclick: () => { state.date = today(); render(); } }, 'Go to today')),
    h('section', { class: 'card kcal' },
      h('div', { class: 'kcal-row' },
        h('div', {}, h('div', { class: 'big' }, kc(s.eaten)), h('div', { class: 'muted small' }, 'kcal eaten')),
        h('div', {}, h('div', { class: 'big' }, kc(s.planned)), h('div', { class: 'muted small' }, 'kcal planned')),
        h('div', {}, h('div', { class: 'big' }, kc(goal)), h('div', { class: 'muted small' }, 'daily goal'))),
      h('div', { class: 'bar' }, h('div', { class: 'bar-plan', style: { width: plannedPct + '%' } }), h('div', { class: 'bar-eat', style: { width: pct + '%', background: p.color } })),
      h('div', { class: 'small muted' }, goal ? (s.total ? (remaining >= 0 ? `Plan has ${kc(remaining)} kcal left to fill.` : `Plan is ${kc(-remaining)} kcal over the goal.`) : 'Nothing planned yet.') : 'Set a calorie goal under Family.',
        s.total ? ` ${s.logged} of ${s.total} meals logged.` : '')),
    s.total > 0 && h('div', { class: 'btn-row tight' }, h('button', { class: 'btn small', onclick: () => groceriesSheet(p) }, '🛒 Grocery list')),
    !s.total && h('section', { class: 'card empty-day' },
      h('p', {}, 'No plan for this day yet.'),
      chartDay && h('button', { class: 'btn primary', onclick: () => loadChart(p, state.date, chartDay.week, chartDay.day) }, `Load diet chart: Week ${chartDay.week}, Day ${chartDay.day}`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => chartPicker(p) }, 'Pick a diet chart day'),
        h('button', { class: 'btn', onclick: () => autoFill(p) }, 'Build from my recipes'),
        h('button', { class: 'btn', onclick: () => copyDay(p, addDays(state.date, -1)) }, 'Copy previous day'))),
    SLOTS.map((slot, si) => slotSection(p, si, s.items.filter(i => i.slot === si))),
    s.total > 0 && h('div', { class: 'btn-row center' },
      h('button', { class: 'btn small', onclick: () => chartPicker(p) }, 'Replace with chart day'),
      h('button', { class: 'btn small', onclick: () => autoFill(p) }, 'Fill empty meals from recipes'),
      h('button', { class: 'btn small danger', onclick: () => { if (confirm('Clear this day’s plan and logs?')) del('plan_items', s.items.map(i => i.id)); } }, 'Clear day')),
  );
}

function slotSection(p, si, items) {
  const slot = SLOTS[si];
  return h('section', { class: 'slot' },
    h('div', { class: 'slot-head' },
      h('span', { class: 'slot-icon' }, slot.icon),
      h('div', {}, h('div', { class: 'slot-name' }, slot.name), h('div', { class: 'muted small' }, slot.time)),
      h('span', { class: 'slot-kcal muted small' }, items.length ? kc(items.reduce((a, i) => a + (i.kcal || 0), 0)) + ' kcal' : ''),
      h('button', { class: 'icon-btn add', 'aria-label': 'Add to ' + slot.name, onclick: () => itemSheet(p, si) }, '+')),
    items.map(i => itemCard(i)));
}

function itemCard(i) {
  const r = i.recipe_id && recipeById(i.recipe_id);
  const st = STATUS[i.status || 'planned'];
  const set = status => {
    if (status === 'changed') return changeSheet(i);
    save('plan_items', { ...i, status: i.status === status ? 'planned' : status });
  };
  return h('article', { class: 'item ' + st.cls },
    h('div', { class: 'item-main', onclick: () => mealDetail(i) },
      h('div', { class: 'item-title' }, i.title, i.status && i.status !== 'planned' && h('span', { class: 'badge ' + st.cls }, st.label)),
      i.details && i.details.trim() !== i.title && h('div', { class: 'item-details' }, i.details.split('\n').filter(l => l.replace(/^\+\s*/, '').trim() !== i.title).join('\n')),
      h('div', { class: 'item-meta muted small' },
        i.kcal != null && `${kc(i.kcal)} kcal${i.kcal_est ? ' (est.)' : ''}`,
        r && h('span', {}, ' · recipe'),
        i.source && h('span', {}, ' · ' + i.source)),
      i.status === 'changed' && h('div', { class: 'changed' }, h('b', {}, 'Changed to: '), i.actual || '—', i.actual_kcal != null && ` (${kc(i.actual_kcal)} kcal)`),
      i.note && h('div', { class: 'note' }, '📝 ', i.note)),
    h('div', { class: 'item-actions' },
      h('button', { class: 'chip ok' + (i.status === 'done' ? ' on' : ''), onclick: () => set('done') }, '✓ Done'),
      h('button', { class: 'chip chg' + (i.status === 'changed' ? ' on' : ''), onclick: () => set('changed') }, '✎ Changed'),
      h('button', { class: 'chip skip' + (i.status === 'skipped' ? ' on' : ''), onclick: () => set('skipped') }, '✕ Skipped'),
      h('button', { class: 'chip swap', onclick: () => swapSheet(i) }, '⇄ Swap')));
}

const videoSearch = q => 'https://www.youtube.com/@vencutcook/search?query=' + encodeURIComponent(q);
const cleanTitle = t => t.replace(/^(\d+(\.\d+)?|½|one)\s*(katori|cup|bowl|glass|small|big|soup bowl|no)?\s*(of\s*)?/i, '').replace(/\(.*?\)/g, '').replace(/[–-].*$/, '').trim();

function mealGroceries(i) {
  const r = i.recipe_id && recipeById(i.recipe_id);
  if (r?.ingredients) return groceriesFromIngredients(r.ingredients);
  return groceriesFromText([i.title, i.details].filter(Boolean).join('\n'));
}

function groceryList(items, keyPrefix) {
  const byAisle = {};
  items.forEach(g => (byAisle[g.aisle] ||= []).push(g));
  const ck = name => keyPrefix + '|' + name;
  let checked = {}; try { checked = JSON.parse(safeGet('fdp-grocery-checks') || '{}'); } catch { /* ignore */ }
  return h('div', { class: 'groceries' }, AISLES.filter(a => byAisle[a]).map(a => h('div', { class: 'aisle' },
    h('div', { class: 'aisle-name' }, a),
    byAisle[a].map(g => {
      const box = h('input', { type: 'checkbox', checked: !!checked[ck(g.name)] });
      box.addEventListener('change', () => { checked[ck(g.name)] = box.checked; if (!box.checked) delete checked[ck(g.name)]; safeSet('fdp-grocery-checks', JSON.stringify(checked)); });
      return h('label', { class: 'g-item' }, box, h('span', {}, g.name), g.qty && h('span', { class: 'muted small' }, g.qty), g.count > 1 && h('span', { class: 'muted small' }, `×${g.count} meals`));
    }))));
}

function mealDetail(i) {
  const p = profileById(i.profile_id);
  const r = i.recipe_id && recipeById(i.recipe_id);
  const g = mealGroceries(i);
  const dlg = sheet(i.title, h('div', {},
    h('p', { class: 'muted small' }, `${p.name} · ${SLOTS[i.slot].name} (${SLOTS[i.slot].time}) · ${fmtDate(i.date)}`, i.kcal != null && ` · ${kc(i.kcal)} kcal${i.kcal_est ? ' (est.)' : ''}`, i.source && ` · ${i.source}`),
    i.details && h('div', {}, h('h3', {}, 'How to make it'), h('div', { class: 'pre' }, i.details)),
    i.swapped_from && h('p', { class: 'muted small' }, 'Swapped from: ', i.swapped_from),
    r && h('div', { class: 'card recipe-box' },
      h('h3', {}, '📖 ', r.name),
      r.steps && h('div', { class: 'pre' }, r.steps),
      h('div', { class: 'btn-row' },
        r.url && h('a', { class: 'btn small', href: r.url, target: '_blank', rel: 'noopener' }, 'Full recipe ↗'),
        r.video && h('a', { class: 'btn small', href: r.video, target: '_blank', rel: 'noopener' }, '▶ Watch video'),
        h('button', { class: 'btn small', onclick: () => { dlg.close(); recipeDetail(r); } }, 'Recipe details'))),
    h('h3', {}, '🛒 Groceries for this meal'),
    g.length ? groceryList(g, 'meal:' + i.id) : h('p', { class: 'muted small' }, 'No ingredients found. Link a recipe with an ingredient list to see groceries here.'),
    !r?.ingredients && g.length > 0 && h('p', { class: 'muted small' }, 'Picked out of the meal description, so double-check quantities.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: () => { dlg.close(); swapSheet(i); } }, '⇄ Swap or suggest another meal'),
      h('button', { class: 'btn', onclick: () => { dlg.close(); itemSheet(p, i.slot, i); } }, 'Edit'),
      !r?.video && h('a', { class: 'btn', href: videoSearch(cleanTitle(r?.name || i.title)), target: '_blank', rel: 'noopener' }, '▶ Find a Vencut Cook video'))));
}

function swapOptions(i) {
  const k = i.slot; const target = i.kcal || CHART_KCAL[k];
  const opts = [];
  CHARTS.forEach(c => c.days.forEach(d => {
    const { title, details } = chartMeal(d.slots[k]);
    if (title === i.title || details === i.details) return;
    opts.push({ kind: 'chart', title, details, kcal: CHART_KCAL[k], kcal_est: true, source: `Week ${c.week} · Day ${d.day}`, label: `Diet chart · Week ${c.week}, Day ${d.day}` });
  }));
  state.data.recipes.filter(r => SLOT_CATS[k].includes(r.category) || (k >= 3 && ['lunch', 'dinner'].includes(r.category)))
    .forEach(r => { if (r.id !== i.recipe_id) opts.push({ kind: 'recipe', title: r.name, details: null, kcal: r.kcal, recipe_id: r.id, label: 'Your recipe' + (r.kcal != null ? ` · ${kc(r.kcal)} kcal` : '') }); });
  // Your own recipes first when they fit the calories, then chart meals; shuffled a little so “Suggest” gives new ideas.
  return opts.map(o => ({ o, score: (o.kind === 'recipe' ? -40 : 0) + Math.abs((o.kcal ?? target) - target) * 0.5 + Math.random() * 120 }))
    .sort((a, b) => a.score - b.score).map(x => x.o);
}

function swapSheet(i) {
  let all = swapOptions(i); let shown = 5;
  const q = h('input', { type: 'search', placeholder: 'Search all meals and recipes' });
  const custom = h('input', { type: 'text', placeholder: 'Or type your own meal' });
  const customKcal = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'kcal' });
  const list = h('div', { class: 'pick-list tall' });
  const apply = o => {
    save('plan_items', { ...i, title: o.title, details: o.details ?? null, kcal: o.kcal ?? null, kcal_est: !!o.kcal_est, recipe_id: o.recipe_id || null, source: o.source || null, swapped_from: i.swapped_from || i.title, status: 'planned', actual: null, actual_kcal: null });
    toast('Swapped to ' + (o.title.length > 40 ? o.title.slice(0, 38) + '…' : o.title)); dlg.close();
  };
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const rows = term ? all.filter(o => (o.title + ' ' + (o.details || '')).toLowerCase().includes(term)) : all.slice(0, shown);
    list.replaceChildren(...rows.slice(0, 60).map(o => h('button', { class: 'pick col', type: 'button', onclick: () => apply(o) },
      h('span', { class: 'pick-title' }, o.title), o.details && h('span', { class: 'muted small clamp' }, o.details), h('span', { class: 'muted small' }, o.label))));
    if (!rows.length) list.append(h('p', { class: 'muted small' }, 'Nothing matches.'));
  };
  q.addEventListener('input', draw);
  const dlg = sheet('Swap ' + SLOTS[i.slot].name.toLowerCase(), h('div', {},
    h('p', { class: 'muted small' }, 'Now: ', h('b', {}, i.title), i.kcal != null && ` (${kc(i.kcal)} kcal)`),
    q,
    h('div', { class: 'row-between' }, h('h3', { style: { margin: '12px 0 0' } }, 'Suggestions'),
      h('div', {}, h('button', { class: 'btn small', onclick: () => { all = swapOptions(i); draw(); } }, '🔀 Shuffle'), ' ', h('button', { class: 'btn small', onclick: () => { shown += 5; draw(); } }, 'More'))),
    list,
    h('h3', { style: { marginTop: '16px' } }, 'Something else'),
    h('div', { class: 'two' }, custom, customKcal),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => { if (!custom.value.trim()) { custom.focus(); return; } apply({ title: custom.value.trim(), kcal: num(customKcal.value) }); } }, 'Use this meal'))));
  draw();
}

function groceriesSheet(p) {
  let scope = 'day', who = 'me';
  const body = h('div', {});
  const draw = () => {
    const days = scope === 'day' ? [state.date] : Array.from({ length: 7 }, (_, k) => addDays(state.date, k));
    const pids = who === 'me' ? [p.id] : state.data.profiles.map(x => x.id);
    const merged = new Map();
    let meals = 0;
    for (const pid of pids) for (const d of days) for (const it of itemsFor(pid, d)) {
      if (it.status === 'skipped') continue; meals++;
      for (const g of mealGroceries(it)) {
        const key = g.name.toLowerCase().replace(/\s*\(.*\)$/, '');
        const m = merged.get(key); if (m) m.count++; else merged.set(key, { ...g, qty: '', count: 1 });
      }
    }
    const list = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    body.replaceChildren(
      h('div', { class: 'cats' },
        h('button', { class: 'chip' + (scope === 'day' ? ' on' : ''), onclick: () => { scope = 'day'; draw(); } }, 'This day'),
        h('button', { class: 'chip' + (scope === 'week' ? ' on' : ''), onclick: () => { scope = 'week'; draw(); } }, 'Next 7 days'),
        h('button', { class: 'chip' + (who === 'me' ? ' on' : ''), onclick: () => { who = 'me'; draw(); } }, p.name),
        h('button', { class: 'chip' + (who === 'all' ? ' on' : ''), onclick: () => { who = 'all'; draw(); } }, 'Whole family')),
      h('p', { class: 'muted small' }, `${list.length} items from ${meals} planned meals.`),
      list.length ? groceryList(list, `list:${scope}:${who}:${state.date}`) : h('p', { class: 'muted' }, 'Plan some meals first.'),
      list.length > 0 && h('div', { class: 'btn-row' }, h('button', {
        class: 'btn', onclick: async () => {
          const text = AISLES.map(a => { const xs = list.filter(g => g.aisle === a); return xs.length ? a + ':\n' + xs.map(g => '- ' + g.name).join('\n') : ''; }).filter(Boolean).join('\n\n');
          try { if (navigator.share) await navigator.share({ title: 'Grocery list', text }); else { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); } } catch { /* cancelled */ }
        },
      }, 'Share / copy list')));
  };
  draw();
  sheet('🛒 Grocery list', body);
}

function changeSheet(i) {
  const what = h('textarea', { rows: 3, placeholder: 'e.g. Had 2 rotis instead of rice, skipped the salad' }, i.actual || '');
  const kcal = h('input', { type: 'number', inputmode: 'numeric', placeholder: i.kcal ?? '', value: i.actual_kcal ?? '' });
  const note = h('input', { type: 'text', placeholder: 'How did it go? (optional)', value: i.note || '' });
  const dlg = sheet('What did you change?', h('div', {},
    h('p', { class: 'muted small' }, 'Planned: ', i.title),
    field('What you actually ate', what),
    field('Calories of what you ate', kcal, 'Leave blank to use the planned calories.'),
    field('Note', note),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: () => { save('plan_items', { ...i, status: 'changed', actual: what.value.trim(), actual_kcal: num(kcal.value), note: note.value.trim() || null }); dlg.close(); } }, 'Save change'),
      i.status === 'changed' && h('button', { class: 'btn', onclick: () => { save('plan_items', { ...i, status: 'planned', actual: null, actual_kcal: null }); dlg.close(); } }, 'Undo change'))));
  setTimeout(() => what.focus(), 50);
}

function recipePicker(onPick, preferCats) {
  const q = h('input', { type: 'search', placeholder: 'Search recipes' });
  const list = h('div', { class: 'pick-list' });
  const draw = () => {
    const term = q.value.toLowerCase();
    const rs = state.data.recipes.filter(r => r.name.toLowerCase().includes(term))
      .sort((a, b) => (preferCats.includes(b.category) - preferCats.includes(a.category)) || a.name.localeCompare(b.name));
    list.replaceChildren(...rs.map(r => h('button', { class: 'pick', type: 'button', onclick: () => onPick(r) },
      h('span', {}, r.name), h('span', { class: 'muted small' }, `${r.category || ''} · ${kc(r.kcal)} kcal`))));
    if (!rs.length) list.append(h('p', { class: 'muted small' }, 'No recipes match.'));
  };
  q.addEventListener('input', draw); draw();
  return h('div', {}, q, list);
}

function itemSheet(p, si, item) {
  const editing = !!item;
  const title = h('input', { type: 'text', placeholder: 'e.g. 1 Katori Dal Palak', value: item?.title || '' });
  const details = h('textarea', { rows: 3, placeholder: 'Portions, options, notes' }, item?.details || '');
  const kcal = h('input', { type: 'number', inputmode: 'numeric', value: item?.kcal ?? '' });
  const slotSel = h('select', {}, SLOTS.map((s, k) => h('option', { value: k, selected: k === si }, `${s.name} (${s.time})`)));
  const note = h('input', { type: 'text', value: item?.note || '', placeholder: 'Optional' });
  let recipeId = item?.recipe_id || null;
  const recipeLabel = h('div', { class: 'small muted' });
  const drawRecipe = () => { const r = recipeId && recipeById(recipeId); recipeLabel.replaceChildren(r ? h('span', {}, 'Linked recipe: ', h('b', {}, r.name), ' ', h('button', { class: 'link', type: 'button', onclick: () => { recipeId = null; drawRecipe(); } }, 'unlink')) : ''); };
  drawRecipe();
  const picker = h('details', { class: 'picker', open: !editing },
    h('summary', {}, 'Choose from recipes'),
    recipePicker(r => { recipeId = r.id; title.value = r.name; kcal.value = r.kcal ?? ''; picker.open = false; drawRecipe(); }, SLOT_CATS[si]));
  const dlg = sheet(editing ? 'Edit meal' : `Add to ${SLOTS[si].name}`, h('div', {},
    picker,
    field('Meal', title), recipeLabel,
    field('Details', details),
    h('div', { class: 'two' }, field('Calories', kcal), field('Meal time', slotSel)),
    editing && field('Note', note),
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn primary', onclick: () => {
          if (!title.value.trim()) { title.focus(); return; }
          const base = item || { id: uid(), profile_id: p.id, date: state.date, status: 'planned', sort: Date.now() };
          const newKcal = num(kcal.value);
          save('plan_items', { ...base, slot: +slotSel.value, title: title.value.trim(), details: details.value.trim() || null, kcal: newKcal, kcal_est: newKcal === item?.kcal ? item?.kcal_est || false : false, recipe_id: recipeId, note: editing ? (note.value.trim() || null) : base.note || null });
          dlg.close();
        },
      }, editing ? 'Save' : 'Add meal'),
      editing && h('button', { class: 'btn danger', onclick: () => { del('plan_items', item.id); dlg.close(); } }, 'Remove'),
      editing && recipeId && h('button', { class: 'btn', onclick: () => { dlg.close(); recipeDetail(recipeById(recipeId)); } }, 'Open recipe'))));
}

function chartPicker(p) {
  const cd = chartDayFor(p, state.date) || { week: 1, day: 1 };
  const wk = h('select', {}, CHARTS.map(c => h('option', { value: c.week, selected: c.week === cd.week }, c.title)));
  const dy = h('select', {}, [1, 2, 3, 4, 5, 6, 7].map(d => h('option', { value: d, selected: d === cd.day }, 'Day ' + d)));
  const preview = h('div', { class: 'chart-preview' });
  const draw = () => {
    const c = CHARTS.find(c => c.week === +wk.value); const d = c.days.find(d => d.day === +dy.value);
    preview.replaceChildren(h('p', { class: 'muted small' }, c.subtitle), ...d.slots.map((t, k) => h('div', { class: 'cp-slot' }, h('b', {}, SLOTS[k].time + ' · ' + SLOTS[k].name), h('div', {}, t))));
  };
  wk.addEventListener('change', draw); dy.addEventListener('change', draw); draw();
  const dlg = sheet('Diet chart', h('div', {},
    h('div', { class: 'two' }, field('Week', wk), field('Day', dy)),
    preview,
    h('div', { class: 'btn-row sticky' },
      h('button', { class: 'btn primary', onclick: () => { loadChart(p, state.date, +wk.value, +dy.value); dlg.close(); } }, `Use for ${state.date === today() ? 'today' : fmtDate(state.date)}`))));
}

// Pick a meaningful name for a diet-chart meal: skip side items like the salad, water or tea.
const SIDE_LINE = /^(\+|or|along with|option \d|with)$|mixed vegetable salad|vegetable salad \(|detox water|warm water|^1 glass buttermilk|^buttermilk|chai\/coffee|^– |^\(|almonds, soaked/i;
function chartMeal(text) {
  const lines = text.split('\n');
  const main = lines.find(l => !SIDE_LINE.test(l.replace(/^\+\s*/, '').trim())) || lines[0];
  const title = main.replace(/^\+\s*/, '').replace(/^OR\s+/i, '').trim() || lines.find(l => l.replace(/[+\s]/g, '')) || 'Meal';
  return { title, details: text };
}

async function loadChart(p, date, week, day) {
  const existing = itemsFor(p.id, date);
  if (existing.length && !confirm('Replace this day’s current plan? Any logs on it will be removed.')) return;
  const c = CHARTS.find(c => c.week === week); const d = c.days.find(x => x.day === day);
  const rows = d.slots.map((text, k) => {
    const { title, details } = chartMeal(text);
    return { id: uid(), profile_id: p.id, date, slot: k, title, details, kcal: CHART_KCAL[k], kcal_est: true, status: 'planned', source: `Week ${week} · Day ${day}`, sort: k };
  });
  if (existing.length) await del('plan_items', existing.map(i => i.id));
  if (!p.plan_start) {
    // Remember where the chart started so later days can suggest the right chart day.
    const start = addDays(date, -((week - 1) * 7 + (day - 1)));
    save('profiles', { ...p, plan_start: start });
  }
  await save('plan_items', rows);
  toast(`Loaded Week ${week}, Day ${day}`);
}

async function copyDay(p, fromDate) {
  const src = itemsFor(p.id, fromDate);
  if (!src.length) { toast('Nothing planned on ' + fmtDate(fromDate)); return; }
  await save('plan_items', src.map(i => ({ ...i, id: uid(), date: state.date, status: 'planned', actual: null, actual_kcal: null, note: null })));
  toast('Copied ' + src.length + ' meals');
}

function autoFill(p) {
  const goal = p.calorie_goal || 1400;
  const existing = itemsFor(p.id, state.date);
  const used = new Set(state.data.plan_items.filter(i => i.profile_id === p.id && i.date >= addDays(state.date, -2) && i.date < state.date).map(i => i.recipe_id));
  const rows = [];
  SLOTS.forEach((s, k) => {
    if (existing.some(i => i.slot === k)) return;
    const pool = state.data.recipes.filter(r => SLOT_CATS[k].includes(r.category) && r.kcal);
    if (!pool.length) return;
    const target = goal * s.share;
    const ranked = pool.map(r => ({ r, score: Math.abs(r.kcal - target) + (used.has(r.id) ? target : 0) + Math.random() * target * 0.5 })).sort((a, b) => a.score - b.score);
    const r = ranked[0].r;
    rows.push({ id: uid(), profile_id: p.id, date: state.date, slot: k, title: r.name, recipe_id: r.id, kcal: r.kcal, status: 'planned', sort: k });
  });
  if (!rows.length) { toast('No empty meals to fill (or no recipes in those categories)'); return; }
  save('plan_items', rows);
  toast(`Added ${rows.length} meals from your recipes`);
}

// ---------- Recipes ----------
function recipesView() {
  const term = state.recipeQuery.toLowerCase();
  const rs = state.data.recipes
    .filter(r => (state.recipeCat === 'all' || r.category === state.recipeCat) && (r.name + ' ' + (r.ingredients || '') + ' ' + (r.tags || '')).toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name));
  const search = h('input', { type: 'search', placeholder: 'Search recipes or ingredients', value: state.recipeQuery });
  search.addEventListener('input', () => { state.recipeQuery = search.value; const pos = search.selectionStart; render(); const s = document.querySelector('.page input[type=search]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } });
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Recipes'), h('button', { class: 'btn primary', onclick: () => recipeSheet() }, '+ Add recipe')),
    search,
    h('div', { class: 'cats' }, ['all', ...CATEGORIES].map(c => h('button', { class: 'chip' + (state.recipeCat === c ? ' on' : ''), onclick: () => { state.recipeCat = c; render(); } }, c === 'all' ? `All (${state.data.recipes.length})` : c))),
    h('div', { class: 'recipe-list' }, rs.map(r => h('button', { class: 'recipe', onclick: () => recipeDetail(r) },
      h('div', { class: 'recipe-name' }, r.name),
      h('div', { class: 'muted small' }, [r.category, r.kcal != null && `${kc(r.kcal)} kcal`, r.protein != null && `${r.protein} g protein`].filter(Boolean).join(' · '))))),
    !rs.length && h('p', { class: 'muted center' }, 'No recipes found.'));
}

function recipeDetail(r) {
  const used = state.data.plan_items.filter(i => i.recipe_id === r.id).length;
  const date = h('input', { type: 'date', value: state.date });
  const slotSel = h('select', {}, SLOTS.map((s, k) => h('option', { value: k, selected: SLOT_CATS[k].includes(r.category) && !SLOT_CATS.slice(0, k).some(c => c.includes(r.category)) }, s.name)));
  const who = h('select', {}, profilesSorted().map(p => h('option', { value: p.id, selected: p.id === state.viewing }, p.name)));
  const dlg = sheet(r.name, h('div', {},
    h('p', { class: 'muted' }, [r.category, r.kcal != null && `${kc(r.kcal)} kcal per serving`, r.protein != null && `${r.protein} g protein`].filter(Boolean).join(' · ')),
    h('div', { class: 'btn-row' },
      r.url && h('a', { class: 'btn small', href: r.url, target: '_blank', rel: 'noopener' }, 'Open full recipe ↗'),
      h('a', { class: 'btn small', href: r.video || videoSearch(r.name), target: '_blank', rel: 'noopener' }, r.video ? '▶ Watch video' : '▶ Find a Vencut Cook video')),
    r.ingredients && h('div', {}, h('h3', {}, '🛒 Ingredients / groceries'), groceryList(groceriesFromIngredients(r.ingredients), 'recipe:' + r.id)),
    r.steps && h('div', {}, h('h3', {}, 'Steps'), h('div', { class: 'pre' }, r.steps)),
    r.notes && h('div', {}, h('h3', {}, 'Notes'), h('div', { class: 'pre' }, r.notes)),
    h('p', { class: 'muted small' }, `Used in ${used} planned meal${used === 1 ? '' : 's'}.`),
    h('div', { class: 'card add-plan' },
      h('h3', {}, 'Add to a plan'),
      h('div', { class: 'two' }, field('Who', who), field('Date', date)),
      field('Meal', slotSel),
      h('button', {
        class: 'btn primary', onclick: () => {
          save('plan_items', { id: uid(), profile_id: who.value, date: date.value || state.date, slot: +slotSel.value, title: r.name, recipe_id: r.id, kcal: r.kcal ?? null, status: 'planned', sort: Date.now() });
          toast(`Added to ${who.value === state.me ? 'your' : profileById(who.value).name + '’s'} ${SLOTS[+slotSel.value].name.toLowerCase()}`); dlg.close();
        },
      }, 'Add to plan')),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { dlg.close(); recipeSheet(r); } }, 'Edit'),
      h('button', { class: 'btn danger', onclick: () => { if (confirm(`Delete “${r.name}”?`)) { del('recipes', r.id); dlg.close(); } } }, 'Delete'))));
}

function recipeSheet(r) {
  const f = {
    name: h('input', { type: 'text', value: r?.name || '', placeholder: 'e.g. Moong Dal Chilla' }),
    url: h('input', { type: 'url', value: r?.url || '', placeholder: 'https:// (optional)' }),
    video: h('input', { type: 'url', value: r?.video || '', placeholder: 'YouTube link (optional)' }),
    category: h('select', {}, CATEGORIES.map(c => h('option', { value: c, selected: (r?.category || 'lunch') === c }, c))),
    kcal: h('input', { type: 'number', inputmode: 'numeric', value: r?.kcal ?? '' }),
    protein: h('input', { type: 'number', inputmode: 'decimal', value: r?.protein ?? '' }),
    ingredients: h('textarea', { rows: 4, placeholder: 'One per line' }, r?.ingredients || ''),
    steps: h('textarea', { rows: 4 }, r?.steps || ''),
    notes: h('textarea', { rows: 2 }, r?.notes || ''),
  };
  const dlg = sheet(r ? 'Edit recipe' : 'New recipe', h('div', {},
    field('Name', f.name), field('Recipe link', f.url), field('Video link', f.video),
    h('div', { class: 'two' }, field('Category', f.category), field('Calories / serving', f.kcal)),
    field('Protein (g / serving)', f.protein),
    field('Ingredients', f.ingredients), field('Steps', f.steps), field('Notes', f.notes),
    h('div', { class: 'btn-row' }, h('button', {
      class: 'btn primary', onclick: () => {
        if (!f.name.value.trim()) { f.name.focus(); return; }
        save('recipes', { ...(r || { id: uid(), created_at: nowIso(), created_by: state.me }), name: f.name.value.trim(), url: f.url.value.trim() || null, video: f.video.value.trim() || null, category: f.category.value, kcal: num(f.kcal.value), protein: num(f.protein.value), ingredients: f.ingredients.value.trim() || null, steps: f.steps.value.trim() || null, notes: f.notes.value.trim() || null });
        dlg.close();
      },
    }, r ? 'Save' : 'Add recipe'))));
}

// ---------- Family / profiles ----------
function sparkline(points, color) {
  if (points.length < 2) return null;
  const W = 120, H = 36; const vs = points.map(p => p.kg); const min = Math.min(...vs), max = Math.max(...vs); const span = max - min || 1;
  const d = points.map((p, k) => `${k ? 'L' : 'M'}${(k / (points.length - 1)) * W},${H - 4 - ((p.kg - min) / span) * (H - 8)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'spark'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg;
}

function familyView() {
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Family progress')),
    profilesSorted().map(p => {
      const t = dayStats(p.id, today()); const w7 = rangeStats(p.id, 7); const ws = weightsFor(p.id); const last = ws[ws.length - 1]; const first = ws[0];
      return h('button', { class: 'card profile-card', style: { '--c': p.color }, onclick: () => go('profile/' + p.id) },
        h('div', { class: 'pc-head' }, avatar(p), h('div', {}, h('div', { class: 'pc-name' }, p.name, p.id === state.me && h('span', { class: 'muted small' }, ' (you)')), h('div', { class: 'muted small' }, `Goal ${kc(p.calorie_goal)} kcal/day`)), h('span', { class: 'chev' }, '›')),
        h('div', { class: 'stats' },
          stat(`${t.logged}/${t.total}`, 'meals logged today'),
          stat(`${kc(t.eaten)}`, 'kcal today'),
          stat(w7.onPlan == null ? '–' : w7.onPlan + '%', 'on plan (7 days)'),
          stat(`${streak(p.id)}🔥`, 'day streak')),
        h('div', { class: 'pc-weight' },
          last ? h('span', {}, h('b', {}, last.kg + ' kg'), first && first !== last ? h('span', { class: 'muted small' }, ` (${(last.kg - first.kg > 0 ? '+' : '') + (last.kg - first.kg).toFixed(1)} kg since ${fmtDate(first.date, { day: 'numeric', month: 'short' })})`) : '') : h('span', { class: 'muted small' }, 'No weight logged yet'),
          p.goal_weight && h('span', { class: 'muted small' }, ` · goal ${p.goal_weight} kg`),
          sparkline(ws.slice(-20), p.color)));
    }),
    h('button', { class: 'btn', onclick: () => profileSheet() }, '+ Add person'));
}
const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, v), h('div', { class: 'stat-l' }, l));

function profileView(p) {
  const w7 = rangeStats(p.id, 7), w30 = rangeStats(p.id, 30);
  const ws = weightsFor(p.id);
  const hist = [];
  for (let k = 0; k < 14; k++) {
    const d = addDays(today(), -k); const s = dayStats(p.id, d);
    hist.push(h('button', { class: 'hist-row', onclick: () => { state.viewing = p.id; state.date = d; go('day'); } },
      h('span', { class: 'hist-date' }, k === 0 ? 'Today' : fmtDate(d)),
      h('span', { class: 'hist-dots' }, s.items.map(i => h('span', { class: 'hd ' + (STATUS[i.status || 'planned'].cls || 'pl'), title: `${SLOTS[i.slot].name}: ${i.title} (${STATUS[i.status || 'planned'].label})` }))),
      h('span', { class: 'muted small' }, s.total ? `${kc(s.eaten)} kcal` : 'no plan')));
  }
  const changes = state.data.plan_items.filter(i => i.profile_id === p.id && i.status === 'changed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return h('div', {},
    h('div', { class: 'page-head' }, h('button', { class: 'icon-btn', onclick: () => go('family'), 'aria-label': 'Back' }, '‹'), avatar(p), h('h1', {}, p.name), h('button', { class: 'btn small', onclick: () => profileSheet(p) }, 'Edit')),
    h('section', { class: 'card' },
      h('div', { class: 'stats' },
        stat(kc(p.calorie_goal), 'kcal goal'),
        stat(w7.avgKcal == null ? '–' : kc(w7.avgKcal), 'avg kcal (7d)'),
        stat(w7.onPlan == null ? '–' : w7.onPlan + '%', 'on plan (7d)'),
        stat(w30.onPlan == null ? '–' : w30.onPlan + '%', 'on plan (30d)')),
      h('p', { class: 'muted small' }, '“On plan” is the share of logged meals marked Done rather than Changed or Skipped.')),
    h('section', { class: 'card' },
      h('div', { class: 'row-between' }, h('h3', {}, 'Weight'), h('button', { class: 'btn small primary', onclick: () => weightSheet(p) }, '+ Log weight')),
      ws.length ? h('div', {},
        sparkline(ws.slice(-30), p.color),
        h('ul', { class: 'weights' }, [...ws].reverse().slice(0, 8).map(w => h('li', {}, h('span', {}, fmtDate(w.date)), h('b', {}, w.kg + ' kg'), h('button', { class: 'link', onclick: () => del('weights', w.id) }, 'remove'))))) : h('p', { class: 'muted small' }, 'No weights yet.'),
      (p.start_weight || p.goal_weight) && h('p', { class: 'muted small' }, [p.start_weight && `Start ${p.start_weight} kg`, p.goal_weight && `Goal ${p.goal_weight} kg`].filter(Boolean).join(' · '))),
    h('section', { class: 'card' }, h('h3', {}, 'Last 14 days'), h('p', { class: 'muted small' }, 'Tap a day to open it. ', h('span', { class: 'hd ok' }), ' done ', h('span', { class: 'hd chg' }), ' changed ', h('span', { class: 'hd skip' }), ' skipped ', h('span', { class: 'hd pl' }), ' not logged'), hist),
    changes.length > 0 && h('section', { class: 'card' }, h('h3', {}, 'Recent changes'),
      changes.map(i => h('div', { class: 'change-row' }, h('div', { class: 'muted small' }, `${fmtDate(i.date)} · ${SLOTS[i.slot].name}`), h('div', {}, h('s', {}, i.title), ' → ', i.actual || '—')))),
  );
}

function profileSheet(p) {
  const name = h('input', { type: 'text', value: p?.name || '' });
  const emoji = h('input', { type: 'text', value: p?.emoji || '', maxlength: 4, placeholder: '🙂' });
  const goal = h('input', { type: 'number', inputmode: 'numeric', value: p?.calorie_goal ?? 1400 });
  const sw = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', value: p?.start_weight ?? '' });
  const gw = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', value: p?.goal_weight ?? '' });
  const ps = h('input', { type: 'date', value: p?.plan_start || '' });
  let color = p?.color || COLORS[state.data.profiles.length % COLORS.length];
  const sw8 = h('div', { class: 'swatches' });
  const drawSw = () => sw8.replaceChildren(...COLORS.map(c => h('button', { type: 'button', class: 'swatch' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': c, onclick: () => { color = c; drawSw(); } })));
  drawSw();
  const dlg = sheet(p ? 'Edit ' + p.name : 'Add person', h('div', {},
    h('div', { class: 'two' }, field('Name', name), field('Emoji', emoji)),
    field('Colour', sw8),
    field('Daily calorie goal', goal),
    h('div', { class: 'two' }, field('Start weight (kg)', sw), field('Goal weight (kg)', gw)),
    field('Diet chart start date', ps, 'Day 1 of Week 1. Used to suggest the right chart day each day.'),
    h('div', { class: 'btn-row' },
      h('button', {
        class: 'btn primary', onclick: () => {
          if (!name.value.trim()) { name.focus(); return; }
          save('profiles', { ...(p || { id: uid(), sort: state.data.profiles.length, created_at: nowIso() }), name: name.value.trim(), emoji: emoji.value.trim() || null, color, calorie_goal: num(goal.value), start_weight: num(sw.value), goal_weight: num(gw.value), plan_start: ps.value || null });
          dlg.close();
        },
      }, 'Save'),
      p && p.id !== state.me && h('button', { class: 'btn', onclick: () => { state.me = p.id; safeSet('fdp-me', p.id); dlg.close(); render(); toast('This phone now belongs to ' + p.name); } }, 'This is me'))));
}

function weightSheet(p) {
  const d = h('input', { type: 'date', value: today() });
  const kg = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'kg' });
  const dlg = sheet('Log weight for ' + p.name, h('div', {},
    h('div', { class: 'two' }, field('Date', d), field('Weight (kg)', kg)),
    h('button', {
      class: 'btn primary', onclick: () => {
        if (num(kg.value) == null) { kg.focus(); return; }
        const existing = state.data.weights.find(w => w.profile_id === p.id && w.date === d.value);
        save('weights', { id: existing?.id || uid(), profile_id: p.id, date: d.value, kg: num(kg.value) });
        dlg.close();
      },
    }, 'Save')));
  setTimeout(() => kg.focus(), 50);
}

// ---------- Settings ----------
function settingsView() {
  const conf = getSupabaseConfig();
  const me = profileById(state.me);
  return h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('section', { class: 'card' },
      h('h3', {}, 'This phone'),
      h('p', {}, 'Signed in as ', h('b', {}, me.name), '. ', h('button', { class: 'link', onclick: () => { state.me = null; safeSet('fdp-me', ''); render(); } }, 'Switch person'))),
    h('section', { class: 'card' },
      h('h3', {}, 'Family sync'),
      backend.kind === 'supabase'
        ? h('div', {}, h('p', {}, '✅ Synced. Everyone’s changes show up on every device.'),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn', onclick: () => reload().then(() => toast('Up to date')) }, 'Refresh now'),
            h('button', { class: 'btn', onclick: async () => { await backend.signOut(); location.reload(); } }, 'Sign out'),
            !conf.fromFile && h('button', { class: 'btn danger', onclick: () => { if (confirm('Disconnect this device from family sync?')) { clearSupabaseConfig(); location.reload(); } } }, 'Disconnect')))
        : h('div', {}, h('p', {}, '⚠️ Data is only saved on this device. Connect a free Supabase project so all three of you share one plan.'), syncForm())),
    h('section', { class: 'card' },
      h('h3', {}, 'Backup'),
      h('p', { class: 'muted small' }, 'Download everything as a file, or restore from one.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: exportData }, 'Download backup'),
        h('label', { class: 'btn' }, 'Restore backup', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: e => importData(e.target.files[0]) })))),
    h('section', { class: 'card' },
      h('h3', {}, 'Install on your phone'),
      h('p', { class: 'small' }, 'iPhone: open in Safari, tap Share, then “Add to Home Screen”. Android: open in Chrome, tap ⋮, then “Install app” or “Add to Home screen”.')),
    h('p', { class: 'muted small center' }, 'Calories marked “est.” are rough estimates. Diet chart meals come from your Week 1–8 charts.'));
}

function syncForm() {
  const url = h('input', { type: 'url', placeholder: 'https://xxxx.supabase.co' });
  const key = h('input', { type: 'text', placeholder: 'anon public key' });
  return h('details', {}, h('summary', {}, 'Connect to Supabase'),
    field('Project URL', url), field('Anon key', key),
    h('button', { class: 'btn primary', onclick: () => { if (!url.value || !key.value) return; saveSupabaseConfig(url.value, key.value); location.reload(); } }, 'Connect'));
}

function exportData() {
  const blob = new Blob([JSON.stringify({ exported_at: nowIso(), ...state.data }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `family-diet-backup-${today()}.json` }); document.body.append(a); a.click(); a.remove();
}
async function importData(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!confirm('Restore this backup? Matching items are overwritten; nothing is deleted.')) return;
    await backend.replaceAll(d); await reload(); toast('Backup restored');
  } catch (e) { toast('Could not restore: ' + e.message); }
}

// ---------- login (Supabase mode) ----------
function loginView(err) {
  const email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'family email' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'password' });
  const msg = h('p', { class: 'error' }, err || '');
  const form = h('form', {
    class: 'card login', onsubmit: async e => {
      e.preventDefault(); msg.textContent = 'Signing in…';
      try { await backend.signIn(email.value.trim(), pw.value); start(); } catch (x) { msg.textContent = x.message || 'Sign in failed'; }
    },
  }, h('h1', {}, '🥗 Family Diet Plan'), h('p', { class: 'muted' }, 'Sign in with the family account.'), field('Email', email), field('Password', pw), h('button', { class: 'btn primary', type: 'submit' }, 'Sign in'), msg,
    h('button', { class: 'link small', type: 'button', onclick: () => { if (confirm('Stop using family sync on this device?')) { clearSupabaseConfig(); location.reload(); } } }, 'Use without sync instead'));
  $('#app').replaceChildren(h('div', { class: 'page center' }, form));
}

// ---------- boot ----------
async function start() {
  try { await backend.init(); } catch (e) { $('#app').replaceChildren(h('div', { class: 'page center' }, h('p', {}, 'Could not reach the sync server. Check your connection and reload.'), h('button', { class: 'btn', onclick: () => location.reload() }, 'Reload'))); return; }
  const session = await backend.session();
  if (!session) { loginView(); return; }
  state.syncing = true; render();
  await reload();
  if (!state.loadError && (!state.data.profiles.length || !state.data.recipes.length)) {
    try { await seedIfEmpty(); } catch (e) { state.loadError = e.message || String(e); }
    if (!state.loadError) await reload(); else render();
  }
  backend.subscribe(reload);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reload(); });
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
start();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
