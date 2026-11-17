import { $, el, state, store, attempt, render, renderHeader, views, hooks, showView, openSheet, closeSheet, field, courseInput, localDate, courses, toast } from './core.js';

const filter = { q: '', course: null };
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

// shortcut: client-side search over all notes; fine for two people's data, move to SQL ilike if notes reach thousands.
function matches(n) {
  const q = filter.q.trim().toLowerCase();
  return (!filter.course || n.course === filter.course) && (!q || (n.course + ' ' + n.body).toLowerCase().includes(q));
}

function renderList() {
  const list = state.notes.filter(matches);
  $('#notes-list').className = list.length ? 'panel' : '';
  $('#notes-list').replaceChildren(...(list.length ? list.map(n => el('div', { className: 'card' },
    el('div', { className: 'body' },
      el('button', { className: 'title', type: 'button', onclick: () => openNote(n) }, n.body.split('\n').find(l => l.trim()) || '(โน้ตว่าง)'),
      el('div', { className: 'meta' }, n.course && el('span', {}, n.course), el('span', {}, fmtDate(n.note_date))))))
    : [el('p', { className: 'empty' }, state.notes.length ? 'ไม่พบโน้ตที่ค้นหา' : 'ยังไม่มีโน้ต', !state.notes.length && el('span', { className: 'muted' }, 'กด ＋ เพื่อจดโน้ตแรก'))]));
}

function renderNotes() {
  const view = $('#view-notes');
  if (!view.querySelector('.search')) {
    view.append(
      el('input', { className: 'search', type: 'search', placeholder: 'ค้นหาโน้ต...', 'aria-label': 'ค้นหาโน้ต',
        oninput: e => { filter.q = e.target.value; renderList(); } }),
      el('div', { className: 'chips', id: 'note-chips' }),
      el('div', { id: 'notes-list' }));
  }
  const cs = [...new Set(state.notes.map(n => n.course).filter(Boolean))].sort();
  if (filter.course && !cs.includes(filter.course)) filter.course = null;
  $('#note-chips').replaceChildren(...(cs.length ? [null, ...cs] : []).map(c => el('button', {
    type: 'button', className: filter.course === c ? 'on' : '', onclick: () => { filter.course = c; renderNotes(); },
  }, c || 'ทั้งหมด')));
  renderList();
}

function openNote(note) {
  const lines = note.body.split('\n').filter(l => l.trim());
  openSheet(`${note.course || 'โน้ต'} · ${fmtDate(note.note_date)}`,
    el('div', {}, lines.length ? lines.map(line => el('div', { className: 'note-line' },
      el('p', {}, line),
      el('button', { type: 'button', className: 'chip', 'aria-label': 'เพิ่มเป็นงาน: ' + line, onclick: e => lineToTask(note, line, e.currentTarget) }, '＋งาน')))
      : el('p', { className: 'muted' }, 'โน้ตว่าง')),
    el('div', { className: 'actions' },
      el('button', { type: 'button', className: 'btn danger', onclick: () => removeNote(note) }, 'ลบ'),
      el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ปิด'),
      el('button', { type: 'button', className: 'btn primary', onclick: () => editNote(note) }, 'แก้ไข')));
}

async function lineToTask(note, line, btn) {
  await attempt(async () => {
    state.tasks.push(await store.addTask({ title: line.trim(), course: note.course, source: 'note', note_id: note.id }));
    btn.disabled = true; btn.textContent = 'เพิ่มแล้ว';
    toast('เพิ่มในงานแล้ว (ยังไม่ระบุวันส่ง)');
    renderHeader();
  });
}

function editNote(note = null) {
  const [courseEl, list] = courseInput(note?.course);
  const form = el('form', {},
    el('div', { className: 'row' },
      field('วิชา', courseEl),
      field('วันที่', el('input', { type: 'date', name: 'note_date', value: note?.note_date || localDate(new Date()), required: true }))),
    list,
    field('จดอะไรไว้', el('textarea', { name: 'body', value: note?.body || '', placeholder: 'เขียนทีละบรรทัด บรรทัดไหนเป็นงาน กด ＋งาน ทีหลังได้' })),
    el('div', { className: 'actions' },
      el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ยกเลิก'),
      el('button', { type: 'submit', className: 'btn primary' }, 'บันทึก')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const data = { id: note?.id, course: f.get('course').trim(), note_date: f.get('note_date'), body: f.get('body') };
    await attempt(async () => {
      const saved = await store.saveNote(data);
      state.notes = [saved, ...state.notes.filter(n => n.id !== saved.id)]
        .sort((a, b) => b.note_date.localeCompare(a.note_date));
      closeSheet(); render(); openNote(saved);
    });
  });
  openSheet(note ? 'แก้ไขโน้ต' : 'จดโน้ตใหม่', form);
}

async function removeNote(note) {
  if (!confirm('ลบโน้ตนี้ใช่ไหม?')) return;
  await attempt(async () => {
    await store.deleteNote(note.id);
    state.notes = state.notes.filter(n => n.id !== note.id);
    for (const t of state.tasks) if (t.note_id === note.id) t.note_id = null;
    closeSheet(); render();
  });
}

views.notes = { render: renderNotes, add: () => editNote() };
hooks.openNote = id => {
  showView('notes');
  const note = state.notes.find(n => n.id === id);
  if (note) openNote(note); else toast('ไม่พบโน้ตต้นทาง');
};
