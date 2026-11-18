import { groupTasks, isDone } from './logic.js';
import { icon } from './pixel.js';
import { $, el, state, store, attempt, render, views, hooks, openSheet, closeSheet, field, courseInput, pad, localDate, celebrate, toast } from './core.js';

const GROUPS = [['overdue', 'เลยกำหนด'], ['today', 'วันนี้'], ['tomorrow', 'พรุ่งนี้'], ['week', 'สัปดาห์นี้'], ['later', 'ภายหลัง'], ['undated', 'ยังไม่ระบุวันส่ง']];
const fmtTime = d => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const fmtDue = (iso, group) => {
  const d = new Date(iso);
  if (group === 'today' || group === 'tomorrow') return fmtTime(d);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(d);
};

function taskCard(task, group) {
  const done = isDone(task);
  const byClassroom = done && !task.done_manual; // turned in on Classroom: can't untick here
  return el('div', { className: 'card' + (done ? ' done' : '') },
    el('button', {
      type: 'button', className: 'check', role: 'checkbox', 'aria-checked': String(done), disabled: byClassroom,
      'aria-label': (done ? 'ยกเลิกเสร็จ: ' : 'ทำเสร็จแล้ว: ') + task.title,
      title: byClassroom ? 'ส่งใน Classroom แล้ว' : null,
      onclick: () => toggleDone(task),
    }, done ? icon('check', '#4A3A3F') : ''),
    el('div', { className: 'body' },
      el('button', { className: 'title', type: 'button', onclick: () => openTaskSheet(task) }, task.title),
      el('div', { className: 'meta' },
        task.course && el('span', {}, task.course),
        task.due_at && el('span', { className: 'num' }, fmtDue(task.due_at, group)),
        task.source === 'classroom' && (task.classroom_link
          ? el('a', { className: 'tag', href: task.classroom_link, target: '_blank', rel: 'noopener' }, 'Classroom')
          : el('span', { className: 'tag' }, 'Classroom')),
        task.source === 'note' && task.note_id && el('button', { className: 'tag', type: 'button', onclick: () => hooks.openNote(task.note_id) }, 'จากโน้ต'),
        task.source === 'note' && !task.note_id && el('span', { className: 'tag' }, 'จากโน้ต'),
      )));
}

function renderTasks() {
  const groups = groupTasks(state.tasks, new Date());
  const sections = GROUPS.filter(([k]) => groups[k].length).map(([k, label]) => el('section', { className: 'group' },
    el('h2', { className: 'group-title' + (k === 'overdue' ? ' late' : '') },
      icon('star', k === 'overdue' ? '#B4455A' : '#F2A7B8'), label, el('span', { className: 'count' }, String(groups[k].length))),
    el('div', { className: 'panel' }, groups[k].map(t => taskCard(t, k)))));
  $('#view-tasks').replaceChildren(
    ...(sections.length ? sections : [el('p', { className: 'empty' }, 'ไม่มีงานค้าง เย้!', el('span', { className: 'muted' }, 'กด ＋ เพื่อจดงานใหม่'))]),
    groups.done.length ? el('details', { className: 'done-group group' },
      el('summary', { className: 'group-title' }, icon('check', '#6B5960'), 'เสร็จแล้ว', el('span', { className: 'count' }, String(groups.done.length))),
      el('div', { className: 'panel' }, groups.done.map(t => taskCard(t, 'done')))) : null,
  );
}

const undo = run => ({ label: 'เลิกทำ', run: () => attempt(async () => { await run(); render(); }) });

async function toggleDone(task, isUndo = false) {
  const nowDone = !task.done_manual;
  await attempt(async () => {
    Object.assign(task, await store.updateTask(task.id, { done_manual: nowDone }));
    if (nowDone && !isUndo) celebrate();
    render();
    if (!isUndo) toast(nowDone ? 'ย้ายไป "เสร็จแล้ว"' : 'ย้ายกลับมาเป็นงานค้าง', undo(() => toggleDone(task, true)));
  });
}

function openTaskSheet(task = null) {
  const due = task?.due_at ? new Date(task.due_at) : null;
  const [courseEl, list] = courseInput(task?.course);
  const err = el('p', { className: 'form-error', role: 'alert' });
  // Classroom rows are overwritten on every sync, so edits/deletes here would silently come back.
  const fromClassroom = task?.source === 'classroom';
  const form = el('form', {},
    el('fieldset', { disabled: fromClassroom, style: 'border:0;padding:0;margin:0' },
      field('ชื่องาน', el('input', { name: 'title', value: task?.title || '', required: true, autocomplete: 'off' })),
      field('วิชา', courseEl), list,
      el('div', { className: 'row' },
        field('วันส่ง (ไม่ใส่ก็ได้)', el('input', { type: 'date', name: 'date', value: due ? localDate(due) : '' })),
        field('เวลา', el('input', { type: 'time', name: 'time', value: due ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : '' })))),
    fromClassroom && el('p', { className: 'muted' }, 'งานนี้มาจาก Classroom แก้ไขใน Classroom แล้วกดรีเฟรชในแอป'),
    err,
    fromClassroom
      ? el('div', { className: 'actions-stack' },
        el('div', { className: 'actions' },
          el('button', { type: 'button', className: 'btn', onclick: () => hideTasks([task], 'ซ่อนงานนี้แล้ว') }, 'ซ่อนงานนี้'),
          task.course && el('button', { type: 'button', className: 'btn', onclick: () => hideTasks(state.tasks.filter(t => t.source === 'classroom' && t.course === task.course), `ซ่อนงานวิชา ${task.course} แล้ว`) }, 'ซ่อนทั้งวิชา')),
        el('div', { className: 'actions' },
        el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ปิด'),
        task.classroom_link && el('a', { className: 'btn primary', href: task.classroom_link, target: '_blank', rel: 'noopener', style: 'text-align:center;text-decoration:none' }, 'เปิดใน Classroom')))
      : el('div', { className: 'actions' },
        task && el('button', { type: 'button', className: 'btn danger', onclick: () => removeTask(task) }, 'ลบงาน'),
        el('button', { type: 'button', className: 'btn', onclick: closeSheet }, 'ยกเลิก'),
        el('button', { type: 'submit', className: 'btn primary' }, 'บันทึก')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const title = f.get('title').trim();
    if (!title) { err.textContent = 'ต้องใส่ชื่องาน'; return; }
    const date = f.get('date');
    const due_at = date ? new Date(`${date}T${f.get('time') || '23:59'}`).toISOString() : null;
    const data = { title, course: f.get('course').trim(), due_at };
    await attempt(async () => {
      if (task) Object.assign(task, await store.updateTask(task.id, data));
      else state.tasks.push(await store.addTask(data));
      closeSheet(); render();
    });
  });
  openSheet(fromClassroom ? 'งานจาก Classroom' : task ? 'แก้ไขงาน' : 'จดงานใหม่', form);
}

// Classroom work can't be deleted (the next sync would bring it back), so it is hidden instead.
async function hideTasks(list, msg) {
  const ids = list.map(t => t.id);
  await attempt(async () => {
    await store.setHidden(ids, true);
    state.tasks = state.tasks.filter(t => !ids.includes(t.id));
    closeSheet(); render();
    toast(msg, undo(async () => { await store.setHidden(ids, false); state.tasks.push(...list); }));
  });
}

async function removeTask(task) {
  await attempt(async () => {
    await store.deleteTask(task.id);
    state.tasks = state.tasks.filter(t => t.id !== task.id);
    closeSheet(); render();
    toast('ลบงานแล้ว', undo(async () => {
      let t = await store.addTask(task);
      if (task.done_manual) t = await store.updateTask(t.id, { done_manual: true });
      state.tasks.push(t);
    }));
  });
}

views.tasks = { render: renderTasks, add: () => openTaskSheet() };
