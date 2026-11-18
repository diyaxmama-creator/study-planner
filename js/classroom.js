// Reads the student's Google Classroom in the browser. No tokens are stored anywhere.
import { classroomDue } from './logic.js';

const API = 'https://classroom.googleapis.com/v1/';
const SCOPES = 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me.readonly';

// Must be called from a click handler (browsers block the Google popup otherwise).
export function getClassroomToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) return reject(new Error('ยังโหลดระบบล็อกอินของ Google ไม่เสร็จ'));
    google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPES,
      callback: r => (r.error ? reject(new Error(r.error)) : resolve(r.access_token)),
      error_callback: e => reject(new Error(e.type || 'google_error')),
    }).requestAccessToken();
  });
}

async function getAll(path, key, token, fetchFn) {
  const out = [];
  let pageToken = '';
  do {
    const r = await fetchFn(API + path + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
      { headers: { Authorization: 'Bearer ' + token } });
    const body = await r.json();
    if (!r.ok) throw new Error(body?.error?.message || `HTTP ${r.status}`);
    out.push(...(body[key] || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return out;
}

export const fetchCourses = (token, fetchFn = fetch) =>
  getAll('courses?courseStates=ACTIVE&studentId=me&pageSize=100', 'courses', token, fetchFn);

export async function fetchClassroom(token, fetchFn = fetch, courses = null) {
  courses ??= await fetchCourses(token, fetchFn);
  const items = [], failedCourses = [];
  await Promise.all(courses.map(async course => {
    try {
      const [work, subs] = await Promise.all([
        getAll(`courses/${course.id}/courseWork?pageSize=100`, 'courseWork', token, fetchFn),
        getAll(`courses/${course.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`, 'studentSubmissions', token, fetchFn),
      ]);
      const state = Object.fromEntries(subs.map(s => [s.courseWorkId, s.state]));
      for (const w of work) items.push({ course: { id: course.id, name: course.name }, work: w, state: state[w.id] ?? null });
    } catch {
      failedCourses.push(course.name);
    }
  }));
  return { items, failedCourses };
}

export function toTaskRows(items, userId) {
  return items.map(({ course, work, state }) => ({
    user_id: userId,
    classroom_id: work.id,
    title: work.title?.trim() || '(ไม่มีชื่องาน)',
    course: course.name,
    due_at: classroomDue(work.dueDate, work.dueTime)?.toISOString() ?? null,
    classroom_link: work.alternateLink ?? null,
    classroom_state: state,
    source: 'classroom',
  }));
}
