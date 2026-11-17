// Entry point: registers views, wires navigation, logs in, loads data.
import { $, store, state, attempt, safeStorage, localDate, showView, views, closeSheet } from './core.js';
import { clickIsOutside } from './logic.js';
import { icon } from './pixel.js';
import './tasks.js';
import './notes.js';
import './schedule.js';
import './settings.js';
import './sync.js';

const NAV_ICONS = { tasks: 'list', schedule: 'cal', notes: 'note' };
document.querySelectorAll('.nav button').forEach(b => {
  b.prepend(icon(NAV_ICONS[b.dataset.view], '#4A3A3F', 3));
  b.addEventListener('click', () => showView(b.dataset.view));
});
$('#settings-btn').append(icon('gear', '#4A3A3F', 3));
$('#refresh-btn').prepend(icon('sync', '#4A3A3F', 2));
$('#settings-btn').addEventListener('click', () => showView('settings'));
$('#fab').addEventListener('click', () => views[state.view]?.add?.());
$('#sheet').addEventListener('click', e => { // only a tap on the dimmed backdrop closes, not on the sheet's edge
  if (e.target.id === 'sheet' && clickIsOutside(e.target.getBoundingClientRect(), e.clientX, e.clientY)) closeSheet();
});

export async function loadAll() {
  [state.tasks, state.notes, state.classes, state.images] = await Promise.all(
    [store.listTasks(), store.listNotes(), store.listClasses(), store.moodImages().catch(() => ({}))]);
}

async function boot() {
  if (!store) {
    $('#login').hidden = false;
    $('#login-btn').hidden = true;
    $('#login-msg').textContent = 'ยังไม่ได้ตั้งค่า Supabase ใน js/config.js (ลองโหมดตัวอย่าง: ?demo=1)';
    return;
  }
  const user = await attempt(() => store.getUser());
  if (!user) {
    $('#login').hidden = false;
    $('#login-btn').onclick = () => attempt(() => store.signIn());
    return;
  }
  const today = localDate(new Date());
  state.firstOpenToday = safeStorage.get('lastOpenDay') !== today;
  safeStorage.set('lastOpenDay', today);
  $('#app').hidden = false;
  try { await loadAll(); } catch { state.loadFailed = true; }
  showView('tasks');
}

boot();
