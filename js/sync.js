import { getClassroomToken, fetchCourses, fetchClassroom, toTaskRows } from './classroom.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { defaultPicked, courseHidingChanges } from './logic.js';
import { $, el, state, store, demo, render, safeStorage, openSheet, closeSheet, thaiError } from './core.js';

const STALE_MS = 6 * 60 * 60 * 1000;

function banner(msg) { const b = $('#banner'); b.textContent = msg || ''; b.hidden = !msg; }

function updateSyncInfo() {
  const last = Number(safeStorage.get('lastSync')) || 0;
  $('#sync-info').textContent = last ? 'ดึงล่าสุด ' + new Date(last).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
  if (Date.now() - last > STALE_MS) banner('แตะรีเฟรชเพื่อดึงงานล่าสุดจาก Classroom');
}

const setSyncing = on => { state.syncing = on; $('#refresh-btn').disabled = on; render(); };

const fmtMonth = iso => iso ? new Date(iso).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }) : '';

// Resolves with the ticked course ids, or null if the sheet was closed.
function pickCourses(courses, prefs) {
  const now = new Date();
  const ticked = c => prefs.seen.includes(c.id) ? prefs.picked.includes(c.id) : defaultPicked(c, now);
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const form = el('form', {},
      el('p', { className: 'muted' }, 'ติ๊กเฉพาะวิชาเทอมนี้ วิชาที่ไม่ติ๊กจะไม่ถูกดึง และงานเก่าของวิชานั้นจะถูกซ่อน เปลี่ยนทีหลังได้ในหน้าตั้งค่า'),
      el('div', { className: 'panel course-pick' }, courses.map(c => el('label', { className: 'card' },
        el('input', { type: 'checkbox', name: 'c', value: c.id, checked: ticked(c) }),
        el('div', { className: 'body' }, el('b', {}, c.name),
          el('div', { className: 'meta' }, [c.section, c.creationTime && 'สร้างเมื่อ ' + fmtMonth(c.creationTime)].filter(Boolean).join(' · ')))))),
      el('div', { className: 'actions' },
        el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ยกเลิก'),
        el('button', { type: 'submit', className: 'btn primary' }, 'ดึงงาน')));
    form.addEventListener('submit', e => { e.preventDefault(); finish(new FormData(form).getAll('c')); closeSheet(); });
    openSheet('เลือกวิชาที่จะดึงงาน', form).addEventListener('close', () => finish(null), { once: true });
  });
}

export async function refresh({ choose = false } = {}) {
  if (!demo && !GOOGLE_CLIENT_ID) { banner('ยังไม่ได้ใส่ Google Client ID ใน js/config.js'); return; }
  const fetchFn = store.classroomFetch || fetch;
  let token = 'demo';
  if (!demo) try {
    token = await getClassroomToken(GOOGLE_CLIENT_ID); // first, while the tap still counts as a user gesture
  } catch {
    banner('ดึงงานจาก Classroom ไม่ได้ตอนนี้ จดงานเองได้ตามปกติ');
    return;
  }
  setSyncing(true);
  try {
    const user = await store.getUser();
    const courses = await fetchCourses(token, fetchFn);
    let prefs = await store.getClassroomPrefs();
    if (choose || courses.some(c => !prefs.seen.includes(c.id))) {
      setSyncing(false);
      const picked = await pickCourses(courses, prefs);
      if (!picked) return;
      setSyncing(true);
      for (const [name, hidden] of courseHidingChanges(courses, prefs, picked)) await store.setCourseHidden(name, hidden);
      prefs = { ...prefs, picked, seen: [...new Set([...prefs.seen, ...courses.map(c => c.id)])] };
      await store.saveClassroomPrefs(prefs);
    }
    const { items, failedCourses } = await fetchClassroom(token, fetchFn, courses.filter(c => prefs.picked.includes(c.id)));
    await store.upsertClassroomTasks(toTaskRows(items, user.id));
    for (const name of prefs.hiddenNames) await store.setCourseHidden(name, true); // new work in a hidden subject
    state.tasks = await store.listTasks();
    safeStorage.set('lastSync', String(Date.now()));
    banner(failedCourses.length ? 'ดึงไม่ได้บางวิชา: ' + failedCourses.join(', ') : '');
    updateSyncInfo();
  } catch (e) {
    banner('ดึงงานจาก Classroom ไม่ได้ตอนนี้: ' + thaiError(e));
  } finally {
    setSyncing(false);
  }
}

$('#refresh-btn').addEventListener('click', () => refresh());
if (!demo) updateSyncInfo();
