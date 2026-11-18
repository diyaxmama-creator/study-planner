// Shared app state and helpers. Views import this; this imports no view (no cycles).
import { groupTasks, pickMood } from './logic.js';
import { renderMascot } from './mascot.js';
import { icon } from './pixel.js';
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

// A popover sits in the top layer, so messages stay visible above an open sheet (a modal dialog).
function showToast(t, on) {
  if (!t.showPopover) { t.hidden = !on; return; } // older browsers: plain element
  t.hidden = false;
  if (t.matches(':popover-open')) t.hidePopover();
  if (on) t.showPopover();
}
export function toast(msg, action = null) {
  const t = $('#toast');
  t.replaceChildren(msg, action ? el('button', { type: 'button', className: 'toast-btn', onclick: () => { showToast(t, false); action.run(); } }, action.label) : '');
  showToast(t, true);
  clearTimeout(toast.timer); toast.timer = setTimeout(() => showToast(t, false), action ? 5000 : 3000);
}
// Our own errors are Thai; library/network ones are English, so show a Thai line and keep the detail in the console.
export function thaiError(e) {
  const msg = e?.message || '';
  if (/[฀-๿]/.test(msg)) return msg;
  console.error(e);
  return /fetch|network|offline/i.test(msg) ? 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง' : 'ทำไม่สำเร็จ ลองใหม่อีกครั้ง';
}
export async function attempt(fn) {
  try { return await fn(); } catch (e) { toast(thaiError(e)); }
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
  renderMascot($('#app'), mood, state.images,
    now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }), refreshImages);
  const cat = $('.deco-cat'), catSrc = state.syncing ? 'img/cat-sync.webp' : 'img/cat.webp';
  if (cat.getAttribute('src') !== catSrc) cat.src = catSrc;
  const pill = $('#overdue-pill');
  pill.hidden = !groups.overdue.length;
  pill.replaceChildren(icon('heart', '#B4455A'), 'เลยกำหนด ', el('span', { className: 'count' }, String(groups.overdue.length)), ' งาน');
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
// Coming back to the app also picks up pictures uploaded from another device (and renews expiring links).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('#app').hidden) refreshImages();
});

export function celebrate() {
  state.justCompleted = true;
  clearTimeout(celebrate.timer);
  celebrate.timer = setTimeout(() => { state.justCompleted = false; renderHeader(); }, 3000);
}
