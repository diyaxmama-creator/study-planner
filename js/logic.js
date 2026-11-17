// Pure logic shared by the app and the tests. No DOM, no network.

// Classroom sends due date/time in UTC.
export function classroomDue(dueDate, dueTime) {
  if (!dueDate) return null;
  const { hours = 0, minutes = 0 } = dueTime || {};
  return new Date(Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, hours, minutes));
}

export function isDone(task) {
  return !!task.done_manual || ['TURNED_IN', 'RETURNED'].includes(task.classroom_state);
}

const dayStart = (d, plusDays = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays);
const time = s => new Date(s).getTime();

export function groupTasks(tasks, now) {
  const g = { overdue: [], today: [], tomorrow: [], week: [], later: [], undated: [], done: [] };
  const tomorrow = dayStart(now, 1), dayAfter = dayStart(now, 2), weekEnd = dayStart(now, 7);
  for (const task of tasks) {
    if (isDone(task)) { g.done.push(task); continue; }
    if (!task.due_at) { g.undated.push(task); continue; }
    const due = new Date(task.due_at);
    if (due < now) g.overdue.push(task);
    else if (due < tomorrow) g.today.push(task);
    else if (due < dayAfter) g.tomorrow.push(task);
    else if (due < weekEnd) g.week.push(task);
    else g.later.push(task);
  }
  for (const k of ['overdue', 'today', 'tomorrow', 'week', 'later']) g[k].sort((a, b) => time(a.due_at) - time(b.due_at));
  g.undated.sort((a, b) => time(a.created_at) - time(b.created_at));
  g.done.sort((a, b) => time(b.due_at ?? b.created_at) - time(a.due_at ?? a.created_at));
  return g;
}

export const MOODS = ['fighting', 'waving', 'allclear', 'studying', 'cheering', 'sleepy', 'morning', 'books', 'sync', 'notes'];

export const MOOD_TEXT = {
  fighting: 'สู้ ๆ นะ!',
  waving: 'วันนี้ก็ทำได้นะ',
  allclear: 'เก่งมาก ♡',
  studying: 'วันนี้มีงานต้องส่งนะ',
  cheering: 'เย้! เสร็จไปอีกงาน',
  sleepy: 'ดึกแล้ว พักบ้างนะ',
  morning: 'อรุณสวัสดิ์ ☀',
  books: 'ค่อย ๆ ทำทีละงานนะ',
  sync: 'กำลังดึงงาน...',
  notes: 'ยังไม่มีโน้ตเลย',
};

export function openCount(groups) {
  return groups.overdue.length + groups.today.length + groups.tomorrow.length +
    groups.week.length + groups.later.length + groups.undated.length;
}

export function pickMood({ groups, now, justCompleted = false, syncing = false, firstOpenToday = false }) {
  const hour = now.getHours(), open = openCount(groups);
  if (justCompleted) return 'cheering';
  if (syncing) return 'sync';
  if (groups.overdue.length) return 'fighting';
  if (hour >= 22 || hour < 5) return 'sleepy';
  if (open >= 5) return 'books';
  if (groups.today.length) return 'studying';
  if (open && firstOpenToday && hour < 11) return 'morning';
  return open ? 'waving' : 'allclear';
}

export const MOOD_FALLBACK = {
  fighting: 'waving', studying: 'waving', books: 'fighting', sleepy: 'waving', morning: 'waving',
  cheering: 'allclear', sync: 'allclear', notes: 'allclear', allclear: 'waving', waving: null,
};

// A click on a <dialog>'s padding has the dialog itself as target, so compare coordinates instead.
export function clickIsOutside(rect, x, y) {
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

export function checkMoodFile(file) {
  const okType = file.type.startsWith('image/') || file.type === 'video/mp4';
  if (!okType || file.size > 15 * 1024 * 1024) throw new Error('ไฟล์ต้องเป็นรูปหรือ mp4 ไม่เกิน 15MB');
}

export function moodImageFor(mood, images) {
  const seen = new Set();
  for (let m = mood; m && !seen.has(m); m = MOOD_FALLBACK[m]) {
    seen.add(m);
    if (images[m]) return { mood: m, ...images[m] };
  }
  return null;
}
