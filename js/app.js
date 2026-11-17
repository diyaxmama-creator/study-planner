// Entry point: registers views, wires navigation, logs in, loads data.
import { $, store, state, attempt, safeStorage, localDate, showView, views, closeSheet } from './core.js';
import './tasks.js';
import './notes.js';

document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('#settings-btn').addEventListener('click', () => showView('settings'));
$('#fab').addEventListener('click', () => views[state.view]?.add?.());
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); }); // tap on backdrop closes

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
  await attempt(loadAll);
  showView('tasks');
}

boot();
