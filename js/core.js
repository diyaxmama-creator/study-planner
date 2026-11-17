// Shared app state and helpers. Views import this; this imports no view (no cycles).
import { groupTasks, pickMood } from './logic.js';
import { renderMascot } from './mascot.js';
import { SUPABASE_URL } from './config.js';

const demoParam = new URLSearchParams(location.search).get('demo');
export const demo = demoParam !== null;
const { createStore } = await import(demo ? './store-demo.js' : './store-supabase.js');
export const store = !demo && !SUPABASE_URL ? null : createStore({ failLoad: demoParam === 'fail' });

export const $ = s => document.querySelector(s);

// Tiny DOM builder; text always goes in as textContent (Classroom titles are untrusted).
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k in n && k !== 'list') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
}

export const safeStorage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const state = {
  tasks: [], notes: [], classes: [], images: {},
  view: 'tasks', justCompleted: false, syncing: false, firstOpenToday: false,
  loadFailed: false, // never show "all clear" when we simply couldn't load
};

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
}
export async function attempt(fn) {
  try { return await fn(); } catch (e) { toast(e.message || 'เกิดข้อผิดพลาด'); }
}

export const pad = n => String(n).padStart(2, '0');
export const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const courses = () => [...new Set([...state.tasks, ...state.notes, ...state.classes].map(x => x.course).filter(Boolean))].sort();

// ---------- bottom sheet ----------
export function openSheet(title, ...content) {
  const sheet = $('#sheet');
  sheet.replaceChildren(el('h2', { className: 'sheet-title' }, title), ...content);
  sheet.showModal();
  return sheet;
}
export const closeSheet = () => $('#sheet').close();
export const field = (label, input) => el('label', { className: 'field' }, el('span', {}, label), input);
export function courseInput(value = '') {
  const id = 'courses-' + Math.random().toString(36).slice(2);
  return [el('input', { name: 'course', value, list: id, autocomplete: 'off' }),
    el('datalist', { id }, courses().map(c => el('option', { value: c })))];
}

// ---------- views ----------
// views[name] = { render(), add?() }; hooks let views call each other without importing each other.
export const views = {};
export const hooks = { openNote: () => showView('notes'), reload: () => location.reload() };

export function renderHeader() {
  const now = new Date();
  const groups = groupTasks(state.tasks, now);
  const mood = state.loadFailed ? 'waving' : state.view === 'notes' && !state.notes.length && !state.justCompleted && !state.syncing
    ? 'notes'
    : pickMood({ groups, now, justCompleted: state.justCompleted, syncing: state.syncing, firstOpenToday: state.firstOpenToday });
  renderMascot($('#hero'), mood, state.images,
    now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }), refreshImages);
  const pill = $('#overdue-pill');
  pill.hidden = !groups.overdue.length;
  pill.textContent = `เลยกำหนด ${groups.overdue.length} งาน`;
}

export function render() {
  renderHeader();
  if (state.loadFailed) {
    $('#view-' + state.view).replaceChildren(el('div', { className: 'empty' },
      el('p', {}, 'โหลดข้อมูลไม่สำเร็จ งานของคุณยังอยู่ ไม่ได้หายไป'),
      el('p', { className: 'muted' }, 'อาจเป็นเพราะเน็ตหลุด หรือฐานข้อมูลถูกพักไว้เพราะไม่ได้ใช้นาน (เปิดกลับได้ที่ Supabase)'),
      el('button', { type: 'button', className: 'btn primary', onclick: () => hooks.reload() }, 'ลองใหม่')));
    return;
  }
  views[state.view]?.render();
}

export function showView(name) {
  state.view = name;
  for (const v of ['tasks', 'schedule', 'notes', 'settings']) $('#view-' + v).hidden = v !== name;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  $('#fab').hidden = state.loadFailed || !views[name]?.add;
  render();
}

// Photo links from Supabase expire after an hour; get fresh ones when one breaks or the app comes back.
let imagesAt = 0; // last refresh; 0 lets the first broken link refresh right away
export async function refreshImages({ force = false } = {}) {
  if (!store || (!force && Date.now() - imagesAt < 60_000)) return; // at most once a minute, so a missing file can't loop
  imagesAt = Date.now();
  try { state.images = await store.moodImages(); } catch { return; }
  render();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - imagesAt > 50 * 60_000) refreshImages({ force: true });
});

export function celebrate() {
  state.justCompleted = true;
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => { state.justCompleted = false; renderHeader(); }, 3000);
}
