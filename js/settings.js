import { MOODS, moodFromFileName } from './logic.js';
import { $, el, state, store, attempt, render, views, toast, refreshImages } from './core.js';
import { refresh } from './sync.js';

const LABELS = {
  angry: ['โกรธ', 'มีงานเลยกำหนด'], fighting: ['สู้ ๆ', 'ใช้แทนถ้ายังไม่มีรูปโกรธ หรือตอนงานเยอะ'], waving: ['โบกมือ', 'มีงานค้าง ยังไม่เลยกำหนด'],
  studying: ['ตั้งใจทำงาน', 'มีงานส่งวันนี้'], cheering: ['ดีใจ', 'ตอนติ๊กงานเสร็จ'], sleepy: ['ง่วง', 'เปิดแอปหลัง 4 ทุ่ม'],
  morning: ['ตอนเช้า', 'เปิดแอปครั้งแรกของวัน'], books: ['งานเยอะ', 'งานค้าง 5 งานขึ้นไป'],
};
// allclear reuses the cheering picture; the cat covers syncing and empty notes, so those slots are hidden.
const SLOTS = MOODS.filter(m => LABELS[m]);

function thumb(img) {
  if (!img) return el('div', { className: 'noimg' }, 'ยังไม่มีรูป');
  const onerror = e => { e.target.replaceWith(el('div', { className: 'noimg' }, 'โหลดรูปไม่ได้')); refreshImages(); };
  return img.type === 'video/mp4'
    ? el('video', { className: 'thumb', src: img.url, muted: true, playsInline: true, onerror })
    : el('img', { className: 'thumb', src: img.url, alt: '', onerror });
}

async function upload(mood, input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  await attempt(async () => {
    await store.uploadMoodImage(mood, file);
    state.images = await store.moodImages();
    toast('อัปโหลดรูปแล้ว');
    render();
  });
}

async function uploadMany(input) {
  const files = [...input.files];
  input.value = '';
  const matched = files.map(f => [moodFromFileName(f.name), f]).filter(([m]) => m && SLOTS.includes(m));
  const skipped = files.length - matched.length;
  if (!matched.length) { toast('ชื่อไฟล์ไม่ตรงช่องไหนเลย (เช่น her-angry.webp)'); return; }
  await attempt(async () => {
    for (const [m, f] of matched) await store.uploadMoodImage(m, f);
    state.images = await store.moodImages();
    toast(`อัปโหลด ${matched.length} รูปแล้ว` + (skipped ? ` ข้าม ${skipped} ไฟล์ที่ชื่อไม่ตรง` : ''));
    render();
  });
}

function renderSettings() {
  $('#view-settings').replaceChildren(
    el('div', { className: 'intro' },
      el('h2', { className: 'group-title' }, 'รูปตัวละครตามอารมณ์'),
      el('p', { className: 'muted' }, 'รูปเก็บแบบส่วนตัว เห็นเฉพาะบัญชีนี้ ใช้ได้ทั้งรูปนิ่ง GIF และ MP4 (ไม่เกิน 15MB) ถ้ายังไม่มีรูปของอารมณ์ไหน แอปจะใช้รูปใกล้เคียงแทน'),
      el('label', { className: 'chip file-btn' }, 'อัปโหลดทีละหลายรูป (ตามชื่อไฟล์)',
        el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4', onchange: e => uploadMany(e.target) }))),
    el('div', { className: 'panel' }, SLOTS.map(m => el('div', { className: 'card mood-row' },
      thumb(state.images[m]),
      el('div', { className: 'body' },
        el('b', {}, LABELS[m][0]),
        el('div', { className: 'muted' }, LABELS[m][1])),
      el('label', { className: 'chip file-btn' }, state.images[m] ? 'เปลี่ยน' : 'อัปโหลด',
        el('input', { type: 'file', accept: 'image/*,video/mp4', 'aria-label': 'อัปโหลดรูป ' + LABELS[m][0],
          onchange: e => upload(m, e.target) }))))),
    el('div', { className: 'settings-actions' },
      el('button', { type: 'button', className: 'btn', onclick: () => refresh({ choose: true }) }, 'เลือกวิชาจาก Classroom'),
      el('button', { type: 'button', className: 'btn', onclick: () => attempt(async () => {
        await store.unhideAll(); state.tasks = await store.listTasks(); toast('แสดงงานที่ซ่อนไว้ทั้งหมดแล้ว'); render();
      }) }, 'แสดงงานที่ซ่อนไว้'),
      el('button', { type: 'button', className: 'btn', onclick: () => attempt(async () => { await store.signOut(); location.reload(); }) }, 'ออกจากระบบ')));
}

views.settings = { render: renderSettings };
