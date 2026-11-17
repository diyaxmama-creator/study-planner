import { $, el, state, store, attempt, render, views, openSheet, closeSheet, field, courseInput } from './core.js';

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']; // index = JS getDay()
const hm = t => (t || '').slice(0, 5);

function renderSchedule() {
  const today = new Date().getDay();
  const order = [0, 1, 2, 3, 4, 5, 6].map(i => (today + i) % 7); // today first, then the rest of the week
  const days = order.map(d => {
    const list = state.classes.filter(c => c.weekday === d).sort((a, b) => hm(a.start_time).localeCompare(hm(b.start_time)));
    if (!list.length && d !== today) return null;
    return el('div', { className: 'day' + (d === today ? ' today' : '') },
      el('h2', { className: 'group-title' }, (d === today ? 'วันนี้ · ' : '') + 'วัน' + DAYS[d]),
      list.length ? list.map(c => el('div', { className: 'card' },
        el('div', { className: 'body' },
          el('button', { className: 'title', type: 'button', onclick: () => editClass(c) }, c.course),
          el('div', { className: 'meta' }, el('span', { className: 'num' }, `${hm(c.start_time)}–${hm(c.end_time)}`), c.room && el('span', {}, c.room)))))
        : el('p', { className: 'muted' }, 'วันนี้ไม่มีเรียน'));
  });
  $('#view-schedule').replaceChildren(...days.filter(Boolean),
    !state.classes.length ? el('p', { className: 'empty' }, 'ยังไม่มีตารางเรียน กด ＋ เพื่อเพิ่มวิชา') : null);
}

function editClass(c = null) {
  const [courseEl, list] = courseInput(c?.course);
  courseEl.required = true;
  const err = el('p', { className: 'form-error', role: 'alert' });
  const form = el('form', {},
    field('วิชา', courseEl), list,
    field('วัน', el('select', { name: 'weekday' }, [1, 2, 3, 4, 5, 6, 0].map(d =>
      el('option', { value: d, selected: c ? c.weekday === d : d === new Date().getDay() }, 'วัน' + DAYS[d])))),
    el('div', { className: 'row' },
      field('เริ่ม', el('input', { type: 'time', name: 'start', value: hm(c?.start_time) || '09:00', required: true })),
      field('จบ', el('input', { type: 'time', name: 'end', value: hm(c?.end_time) || '12:00', required: true }))),
    field('ห้อง', el('input', { name: 'room', value: c?.room || '', autocomplete: 'off' })),
    err,
    el('div', { className: 'actions' },
      c && el('button', { type: 'button', className: 'btn danger', onclick: () => removeClass(c) }, 'ลบ'),
      el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ยกเลิก'),
      el('button', { type: 'submit', className: 'btn primary' }, 'บันทึก')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const data = { id: c?.id, course: f.get('course').trim(), weekday: Number(f.get('weekday')),
      start_time: f.get('start'), end_time: f.get('end'), room: f.get('room').trim() };
    if (!data.course) { err.textContent = 'ต้องใส่ชื่อวิชา'; return; }
    if (data.end_time <= data.start_time) { err.textContent = 'เวลาจบต้องหลังเวลาเริ่ม'; return; }
    await attempt(async () => {
      const saved = await store.saveClass(data);
      state.classes = [...state.classes.filter(x => x.id !== saved.id), saved];
      closeSheet(); render();
    });
  });
  openSheet(c ? 'แก้ไขวิชา' : 'เพิ่มวิชา', form);
}

async function removeClass(c) {
  if (!confirm('ลบวิชานี้ออกจากตารางใช่ไหม?')) return;
  await attempt(async () => {
    await store.deleteClass(c.id);
    state.classes = state.classes.filter(x => x.id !== c.id);
    closeSheet(); render();
  });
}

views.schedule = { render: renderSchedule, add: () => editClass() };
