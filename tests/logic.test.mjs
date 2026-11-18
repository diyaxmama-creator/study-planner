process.env.TZ = 'Asia/Bangkok';
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByCourse, defaultPicked, courseHidingChanges, moodFromFileName, classroomDue, groupTasks, pickMood, moodImageFor, MOOD_TEXT, MOODS, checkMoodFile, clickIsOutside } from '../js/logic.js';

test('classroomDue is UTC', () => {
  assert.equal(classroomDue({year:2026,month:11,day:17},{hours:16,minutes:59}).toISOString(), '2026-11-17T16:59:00.000Z');
  assert.equal(classroomDue({year:2026,month:11,day:17},{}).toISOString(), '2026-11-17T00:00:00.000Z');
  assert.equal(classroomDue(undefined, undefined), null);
});

const now = new Date('2026-11-17T10:00:00+07:00');
const t = (id, due_at, extra={}) => ({id, title:id, due_at, created_at:'2026-11-01T00:00:00Z', done_manual:false, ...extra});

test('groupTasks buckets by local day', () => {
  const g = groupTasks([
    t('late','2026-11-16T12:00:00Z'), t('today','2026-11-17T16:59:00Z'),
    t('midnight', classroomDue({year:2026,month:11,day:17},{hours:17}).toISOString()),
    t('week','2026-11-20T05:00:00Z'), t('later','2026-12-30T05:00:00Z'), t('nodate', null),
    t('handDone','2026-11-16T00:00:00Z',{done_manual:true}), t('crDone','2026-11-18T00:00:00Z',{classroom_state:'TURNED_IN'})], now);
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k,v]) => [k, v.map(x=>x.id)])),
    {overdue:['late'], today:['today'], tomorrow:['midnight'], week:['week'], later:['later'], undated:['nodate'], done:['crDone','handDone']});
});

test('pickMood priority', () => {
  const g = groupTasks([t('late','2026-11-16T12:00:00Z')], now);
  assert.equal(pickMood({groups:g, now, justCompleted:true}), 'cheering');
  assert.equal(pickMood({groups:g, now, syncing:true}), 'sync');
  assert.equal(pickMood({groups:g, now}), 'angry'); // overdue: she is cross with you
  const empty = groupTasks([], now);
  assert.equal(pickMood({groups:empty, now: new Date('2026-11-17T23:00:00+07:00')}), 'sleepy');
  assert.equal(pickMood({groups:empty, now: new Date('2026-11-17T08:00:00+07:00'), firstOpenToday:true}), 'allclear'); // nothing open beats the greeting
  assert.equal(pickMood({groups:empty, now}), 'allclear');
});

test('pickMood books, studying, morning, waving', () => {
  const five = groupTasks([1,2,3,4,5].map(i => t('w'+i, '2026-11-21T05:00:00Z')), now);
  assert.equal(pickMood({groups:five, now}), 'books');
  assert.equal(pickMood({groups:groupTasks([t('d','2026-11-17T15:00:00Z')], now), now}), 'studying');
  const morningNow = new Date('2026-11-17T08:00:00+07:00');
  const one = groupTasks([t('w','2026-11-21T05:00:00Z')], morningNow);
  assert.equal(pickMood({groups:one, now:morningNow, firstOpenToday:true}), 'morning');
  assert.equal(pickMood({groups:one, now:morningNow}), 'waving');
});

test('moodImageFor falls back and never breaks', () => {
  assert.deepEqual(moodImageFor('books', {waving:{url:'w',type:'image/webp'}}), {mood:'waving', url:'w', type:'image/webp'});
  assert.equal(moodImageFor('angry', {}), null);
  // no angry picture yet -> the fist-pump picture stands in
  assert.equal(moodImageFor('angry', { fighting: { url: 'f', type: 'image/webp' } }).mood, 'fighting');
  // all done -> her happy picture, never the cat
  assert.equal(moodImageFor('allclear', { cheering: { url: 'c', type: 'image/webp' } }).mood, 'cheering');
  for (const m of ['sync', 'notes']) assert.equal(moodImageFor(m, { waving: { url: 'w', type: 'image/webp' } }).mood, 'waving', m);
});

test('checkMoodFile accepts images and mp4 up to 15MB only', () => {
  assert.doesNotThrow(() => checkMoodFile({ type: 'image/webp', size: 1000 }));
  assert.doesNotThrow(() => checkMoodFile({ type: 'video/mp4', size: 15 * 1024 * 1024 }));
  assert.throws(() => checkMoodFile({ type: 'application/pdf', size: 10 }), /ไฟล์ต้องเป็นรูปหรือ mp4 ไม่เกิน 15MB/);
  assert.throws(() => checkMoodFile({ type: 'image/png', size: 15 * 1024 * 1024 + 1 }), /15MB/);
});

test('clickIsOutside: taps on the sheet padding stay inside', () => {
  const rect = { left: 0, top: 500, right: 375, bottom: 812 };
  assert.equal(clickIsOutside(rect, 5, 505), false);   // sheet's own padding corner
  assert.equal(clickIsOutside(rect, 370, 810), false);
  assert.equal(clickIsOutside(rect, 100, 300), true);  // backdrop above the sheet
});

test('every mood has Thai copy', () => {
  assert.equal(MOODS.length, 11);
  assert.ok(MOODS.includes('angry'));
  for (const m of MOODS) assert.ok(MOOD_TEXT[m], m);
  assert.equal(MOOD_TEXT.angry, 'ฮึ่ม! งานค้างอยู่นะ');
});

test('moodFromFileName maps upload-folder names to slots', () => {
  assert.equal(moodFromFileName('her-angry.webp'), 'angry');
  assert.equal(moodFromFileName('him-waving.PNG'), 'waving');
  assert.equal(moodFromFileName('sleepy.jpg'), 'sleepy');
  assert.equal(moodFromFileName('her-fighting-2.webp'), null);
  assert.equal(moodFromFileName('cat-sync.webp'), null);
  assert.equal(moodFromFileName('Joyful Hijabi Jump.png'), null);
});

test('defaultPicked ticks only recent courses', () => {
  assert.equal(defaultPicked({ creationTime: '2026-10-20T00:00:00Z' }, now), true);
  assert.equal(defaultPicked({ creationTime: '2025-06-01T00:00:00Z' }, now), false);
  assert.equal(defaultPicked({}, now), false);
});

test('courseHidingChanges: hide unticked new courses, flip only changed seen ones', () => {
  const courses = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }];
  const prefs = { seen: ['a', 'b'], picked: ['a'] };
  // a stays ticked (no change), b newly ticked (unhide), c new + ticked (leave), d new + unticked (hide)
  assert.deepEqual(courseHidingChanges(courses, prefs, ['a', 'b', 'c']), [['B', false], ['D', true]]);
  assert.deepEqual(courseHidingChanges(courses, prefs, ['b', 'c', 'd']), [['A', true], ['B', false]]);
});

test('groupByCourse: subjects A-Z, no-subject last, due order, done left out', () => {
  const g = groupByCourse([t('m2', '2026-11-20T00:00:00Z', { course: 'MATH' }), t('e', null, { course: 'ENG' }),
    t('m1', '2026-11-18T00:00:00Z', { course: 'MATH' }), t('x', null, { course: '' }), t('mu', null, { course: 'MATH' }),
    t('done', null, { course: 'ENG', done_manual: true })]);
  assert.deepEqual(g.map(([c, l]) => [c, l.map(x => x.id)]), [['ENG', ['e']], ['MATH', ['m1', 'm2', 'mu']], ['', ['x']]]);
});
