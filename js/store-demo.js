// In-memory store for ?demo=1 and tests. Same interface as store-supabase.js.
import { checkMoodFile } from './logic.js';

const DEMO_IMAGES = {
  fighting: 'her-fighting-2.webp', waving: 'her-waving.webp', allclear: 'cat-heart.webp',
  studying: 'her-studying.webp', cheering: 'her-cheering.webp', sleepy: 'her-sleepy.webp',
  morning: 'her-morning.webp', books: 'her-books.webp',
};

export function createStore() {
  let seq = 0;
  const id = () => 'demo-' + ++seq;
  const at = (days, h = 23, m = 59) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
  const task = t => ({ id: id(), course: '', due_at: null, source: 'manual', classroom_id: null, classroom_link: null,
    classroom_state: null, done_manual: false, note_id: null, created_at: new Date().toISOString(), ...t });

  const notes = [
    { id: id(), course: 'ENG101', note_date: today(), body: 'บทที่ 3 Present perfect\nอาจารย์บอกให้ส่งสรุปบทที่ 3', created_at: new Date().toISOString() },
    { id: id(), course: 'MATH102', note_date: '2026-11-10', body: 'ลิมิต: ดูตัวอย่างหน้า 45', created_at: new Date().toISOString() },
  ];
  const tasks = [
    task({ title: 'รายงานบทที่ 2', course: 'ENG101', due_at: at(-1), source: 'classroom', classroom_id: 'd1', classroom_link: 'https://classroom.google.com', classroom_state: 'CREATED' }),
    task({ title: 'แบบฝึกหัดที่ 4', course: 'MATH102', due_at: at(0), source: 'classroom', classroom_id: 'd2', classroom_link: 'https://classroom.google.com', classroom_state: 'CREATED' }),
    task({ title: 'อ่านบทที่ 3', course: 'ENG101', due_at: at(1, 9, 0) }),
    task({ title: 'Quiz 2', course: 'CS101', due_at: at(4, 10, 0) }),
    task({ title: 'โปรเจกต์ปลายภาค', course: 'CS101', due_at: at(30) }),
    task({ title: 'สรุปบทที่ 3', course: 'ENG101', source: 'note', note_id: notes[0].id }),
    task({ title: 'แบบฝึกหัดที่ 3', course: 'MATH102', due_at: at(-3), source: 'classroom', classroom_id: 'd3', classroom_state: 'TURNED_IN' }),
  ];
  const classes = [
    { id: id(), course: 'ENG101', weekday: 1, start_time: '09:00', end_time: '12:00', room: 'อาคาร 2 ห้อง 204' },
    { id: id(), course: 'MATH102', weekday: 3, start_time: '13:00', end_time: '16:00', room: 'อาคาร 1 ห้อง 101' },
    { id: id(), course: 'CS101', weekday: new Date().getDay(), start_time: '09:00', end_time: '11:00', room: 'Lab 3' },
  ];
  const images = Object.fromEntries(Object.entries(DEMO_IMAGES).map(([m, f]) => [m, { url: 'assets/characters/' + f, type: 'image/webp' }]));

  const save = (list, row) => {
    if (!row.id) { const r = { ...row, id: id(), created_at: new Date().toISOString() }; list.push(r); return r; }
    const i = list.findIndex(x => x.id === row.id);
    list[i] = { ...list[i], ...row };
    return list[i];
  };
  const remove = (list, rid) => { const i = list.findIndex(x => x.id === rid); if (i >= 0) list.splice(i, 1); };

  return {
    async getUser() { return { id: 'demo', email: 'demo' }; },
    async signIn() {},
    async signOut() {},
    async listTasks() { return tasks.map(t => ({ ...t })); },
    async addTask({ title, course = '', due_at = null, source = 'manual', note_id = null }) {
      if (!title?.trim()) throw new Error('ต้องใส่ชื่องาน');
      const t = task({ title: title.trim(), course, due_at, source, note_id });
      tasks.push(t);
      return { ...t };
    },
    async updateTask(tid, patch) {
      if ('title' in patch && !patch.title?.trim()) throw new Error('ต้องใส่ชื่องาน');
      return { ...save(tasks, { ...patch, id: tid }) };
    },
    async deleteTask(tid) { remove(tasks, tid); },
    async upsertClassroomTasks(rows) {
      for (const r of rows) {
        const old = tasks.find(t => t.classroom_id === r.classroom_id);
        if (old) Object.assign(old, r); else tasks.push(task(r));
      }
    },
    async listNotes() { return [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date)).map(n => ({ ...n })); },
    async saveNote(n) { return { ...save(notes, { course: '', note_date: today(), body: '', ...n }) }; },
    async deleteNote(nid) { remove(notes, nid); for (const t of tasks) if (t.note_id === nid) t.note_id = null; },
    async listClasses() { return classes.map(c => ({ ...c })); },
    async saveClass(c) { return { ...save(classes, c) }; },
    async deleteClass(cid) { remove(classes, cid); },
    async moodImages() { return { ...images }; },
    async uploadMoodImage(mood, file) {
      checkMoodFile(file);
      images[mood] = { url: URL.createObjectURL(file), type: file.type };
    },
  };
}
