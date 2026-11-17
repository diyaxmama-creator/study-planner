import { getClassroomToken, fetchClassroom, toTaskRows } from './classroom.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { $, state, store, demo, render, safeStorage } from './core.js';

const STALE_MS = 6 * 60 * 60 * 1000;

function banner(msg) { const b = $('#banner'); b.textContent = msg || ''; b.hidden = !msg; }

function updateSyncInfo() {
  const last = Number(safeStorage.get('lastSync')) || 0;
  $('#sync-info').textContent = last ? 'ดึงล่าสุด ' + new Date(last).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
  if (Date.now() - last > STALE_MS) banner('แตะรีเฟรชเพื่อดึงงานล่าสุดจาก Classroom');
}

const setSyncing = on => { state.syncing = on; $('#refresh-btn').disabled = on; render(); };

async function refresh() {
  if (demo) { setSyncing(true); setTimeout(() => setSyncing(false), 1000); return; }
  if (!GOOGLE_CLIENT_ID) { banner('ยังไม่ได้ใส่ Google Client ID ใน js/config.js'); return; }
  let token;
  try {
    token = await getClassroomToken(GOOGLE_CLIENT_ID); // first, while the tap still counts as a user gesture
  } catch {
    banner('ดึงงานจาก Classroom ไม่ได้ตอนนี้ จดงานเองได้ตามปกติ');
    return;
  }
  setSyncing(true);
  try {
    const user = await store.getUser();
    const { items, failedCourses } = await fetchClassroom(token);
    await store.upsertClassroomTasks(toTaskRows(items, user.id));
    state.tasks = await store.listTasks();
    safeStorage.set('lastSync', String(Date.now()));
    banner(failedCourses.length ? 'ดึงไม่ได้บางวิชา: ' + failedCourses.join(', ') : '');
    updateSyncInfo();
  } catch {
    banner('ดึงงานจาก Classroom ไม่ได้ตอนนี้ จดงานเองได้ตามปกติ');
  } finally {
    setSyncing(false);
  }
}

$('#refresh-btn').addEventListener('click', refresh);
if (!demo) updateSyncInfo();
