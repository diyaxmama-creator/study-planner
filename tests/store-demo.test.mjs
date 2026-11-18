process.env.TZ = 'Asia/Bangkok';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store-demo.js';

test('addTask applies defaults and is listed', async () => {
  const s = createStore();
  const t = await s.addTask({ title: 'x' });
  const found = (await s.listTasks()).find(r => r.id === t.id);
  assert.equal(found.source, 'manual');
  assert.equal(found.done_manual, false);
  assert.equal(found.due_at, null);
});

test('updateTask persists', async () => {
  const s = createStore();
  const t = await s.addTask({ title: 'x' });
  await s.updateTask(t.id, { done_manual: true });
  assert.equal((await s.listTasks()).find(r => r.id === t.id).done_manual, true);
});

test('blank title is rejected like the database check', async () => {
  await assert.rejects(createStore().addTask({ title: '  ' }));
});

test('saveNote assigns an id and notes list newest date first', async () => {
  const s = createStore();
  const n = await s.saveNote({ course: 'ENG101', note_date: '2099-01-01', body: 'hi' });
  assert.ok(n.id);
  assert.equal((await s.listNotes())[0].id, n.id);
});

test('failLoad option makes loading fail (to exercise the error screen)', async () => {
  await assert.rejects(createStore({ failLoad: true }).listTasks(), /โหลดข้อมูลไม่สำเร็จ/);
});

test('upsertClassroomTasks keeps manual done on re-sync', async () => {
  const s = createStore();
  const row = { user_id: 'demo', classroom_id: 'cw1', title: 'A', course: 'C', due_at: null, classroom_link: '', classroom_state: 'CREATED', source: 'classroom' };
  await s.upsertClassroomTasks([row]);
  const id = (await s.listTasks()).find(r => r.classroom_id === 'cw1').id;
  await s.updateTask(id, { done_manual: true });
  await s.upsertClassroomTasks([{ ...row, title: 'A2' }]);
  const rows = (await s.listTasks()).filter(r => r.classroom_id === 'cw1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'A2');
  assert.equal(rows[0].done_manual, true);
});

test('hidden tasks leave the list and come back with unhideAll', async () => {
  const s = createStore();
  const cr = (await s.listTasks()).filter(t => t.source === 'classroom');
  await s.setHidden(cr.map(t => t.id), true);
  assert.equal((await s.listTasks()).filter(t => t.source === 'classroom').length, 0);
  await s.upsertClassroomTasks([{ classroom_id: cr[0].classroom_id, title: 'synced again', source: 'classroom' }]);
  assert.equal((await s.listTasks()).some(t => t.title === 'synced again'), false); // a sync must not unhide
  await s.unhideAll();
  assert.equal((await s.listTasks()).filter(t => t.source === 'classroom').length, cr.length);
});
