process.env.TZ = 'Asia/Bangkok';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classroomDue, groupTasks, pickMood, moodImageFor, MOOD_TEXT, MOODS, checkMoodFile } from '../js/logic.js';

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
  assert.equal(pickMood({groups:g, now}), 'fighting');
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
  assert.equal(moodImageFor('fighting', {}), null);
});

test('checkMoodFile accepts images and mp4 up to 15MB only', () => {
  assert.doesNotThrow(() => checkMoodFile({ type: 'image/webp', size: 1000 }));
  assert.doesNotThrow(() => checkMoodFile({ type: 'video/mp4', size: 15 * 1024 * 1024 }));
  assert.throws(() => checkMoodFile({ type: 'application/pdf', size: 10 }), /ไฟล์ต้องเป็นรูปหรือ mp4 ไม่เกิน 15MB/);
  assert.throws(() => checkMoodFile({ type: 'image/png', size: 15 * 1024 * 1024 + 1 }), /15MB/);
});

test('every mood has Thai copy', () => {
  assert.equal(MOODS.length, 10);
  for (const m of MOODS) assert.ok(MOOD_TEXT[m], m);
  assert.equal(MOOD_TEXT.fighting, 'สู้ ๆ นะ!');
});
