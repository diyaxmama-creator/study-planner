process.env.TZ = 'Asia/Bangkok';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchClassroom, toTaskRows } from '../js/classroom.js';

// Fake fetch: maps a URL path+query (after /v1/) to [status, body].
const fakeFetch = routes => async url => {
  const key = url.replace('https://classroom.googleapis.com/v1/', '');
  const hit = routes[key];
  if (!hit) throw new Error('unexpected ' + key);
  const [status, body] = hit;
  return { ok: status < 400, status, json: async () => body };
};
const COURSES = 'courses?courseStates=ACTIVE&studentId=me&pageSize=100';
const work = (c, extra = '') => `courses/${c}/courseWork?pageSize=100${extra}`;
const subs = (c, extra = '') => `courses/${c}/courseWork/-/studentSubmissions?userId=me&pageSize=100${extra}`;

test('one failing course is skipped, others still sync', async () => {
  const r = await fetchClassroom('tok', fakeFetch({
    [COURSES]: [200, { courses: [{ id: '1', name: 'Course 1' }, { id: '2', name: 'Course 2' }] }],
    [work('1')]: [200, { courseWork: [{ id: 'w1', title: 'HW1' }] }],
    [subs('1')]: [200, { studentSubmissions: [{ courseWorkId: 'w1', state: 'TURNED_IN' }] }],
    [work('2')]: [403, { error: { message: 'forbidden' } }],
    [subs('2')]: [403, { error: { message: 'forbidden' } }],
  }));
  assert.deepEqual(r.items.map(i => [i.course.name, i.work.id, i.state]), [['Course 1', 'w1', 'TURNED_IN']]);
  assert.deepEqual(r.failedCourses, ['Course 2']);
});

test('courses list failure throws', async () => {
  await assert.rejects(fetchClassroom('tok', fakeFetch({ [COURSES]: [401, { error: { message: 'bad token' } }] })));
});

test('follows nextPageToken', async () => {
  const r = await fetchClassroom('tok', fakeFetch({
    [COURSES]: [200, { courses: [{ id: '1', name: 'C' }] }],
    [work('1')]: [200, { courseWork: [{ id: 'a', title: 'A' }], nextPageToken: 'p2' }],
    [work('1', '&pageToken=p2')]: [200, { courseWork: [{ id: 'b', title: 'B' }] }],
    [subs('1')]: [200, {}],
  }));
  assert.deepEqual(r.items.map(i => i.work.id), ['a', 'b']);
  assert.equal(r.items[0].state, null);
});

test('toTaskRows converts UTC due time and never carries done_manual', () => {
  const [row] = toTaskRows([{ course: { id: '1', name: 'ENG101' }, state: 'CREATED',
    work: { id: 'w1', title: 'Essay', alternateLink: 'https://classroom.google.com/x', dueDate: { year: 2026, month: 11, day: 17 }, dueTime: { hours: 16, minutes: 59 } } }], 'u1');
  assert.deepEqual(row, { user_id: 'u1', classroom_id: 'w1', title: 'Essay', course: 'ENG101', due_at: '2026-11-17T16:59:00.000Z',
    classroom_link: 'https://classroom.google.com/x', classroom_state: 'CREATED', source: 'classroom' });
  assert.equal('done_manual' in row, false);
});

test('toTaskRows: no due date -> null, untitled -> placeholder', () => {
  const [row] = toTaskRows([{ course: { id: '1', name: 'C' }, state: null, work: { id: 'w', title: '' } }], 'u1');
  assert.equal(row.due_at, null);
  assert.equal(row.title, '(ไม่มีชื่องาน)');
});

test('fetchClassroom with a given course list skips listing and other courses', async () => {
  const r = await fetchClassroom('tok', fakeFetch({
    [work('1')]: [200, { courseWork: [{ id: 'w1', title: 'HW1' }] }],
    [subs('1')]: [200, {}],
  }), [{ id: '1', name: 'Only' }]);
  assert.deepEqual(r.items.map(i => i.work.id), ['w1']);
});
