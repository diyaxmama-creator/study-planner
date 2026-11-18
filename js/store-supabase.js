// Real store: Supabase auth + tables + private "characters" bucket. Same interface as store-demo.js.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { checkMoodFile } from './logic.js';

const TYPES = { mp4: 'video/mp4', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const extOf = name => (name.split('.').pop() || '').toLowerCase();

export function createStore() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const run = async p => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id;
  const needTitle = t => { if (!t?.trim()) throw new Error('ต้องใส่ชื่องาน'); return t.trim(); };
  const bucket = () => sb.storage.from('characters');

  return {
    async getUser() {
      const u = (await sb.auth.getSession()).data.session?.user;
      return u ? { id: u.id, email: u.email } : null;
    },
    async signIn() {
      await run(sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
    },
    async signOut() { await sb.auth.signOut(); },

    // Filtered here (not in SQL) so the app still loads before the hidden column is added.
    listTasks: async () => (await run(sb.from('tasks').select('*').order('created_at'))).filter(t => !t.hidden),
    async setHidden(ids, hidden) { // batches keep the URL short when a whole subject has hundreds of tasks
      for (let i = 0; i < ids.length; i += 50) await run(sb.from('tasks').update({ hidden }).in('id', ids.slice(i, i + 50)));
    },
    async setCourseHidden(course, hidden) { await run(sb.from('tasks').update({ hidden }).eq('source', 'classroom').eq('course', course)); },
    // Saved on the account (user_metadata) so phone and computer share the choice.
    async getClassroomPrefs() {
      const p = (await sb.auth.getUser()).data.user?.user_metadata?.classroom;
      return { picked: p?.picked ?? [], seen: p?.seen ?? [] };
    },
    async saveClassroomPrefs(p) { await run(sb.auth.updateUser({ data: { classroom: p } })); },
    async unhideAll() { await run(sb.from('tasks').update({ hidden: false }).eq('hidden', true)); },
    addTask: ({ title, course = '', due_at = null, source = 'manual', note_id = null }) =>
      run(sb.from('tasks').insert({ title: needTitle(title), course, due_at, source, note_id }).select().single()),
    updateTask(id, patch) {
      if ('title' in patch) patch = { ...patch, title: needTitle(patch.title) };
      return run(sb.from('tasks').update(patch).eq('id', id).select().single());
    },
    async deleteTask(id) { await run(sb.from('tasks').delete().eq('id', id)); },
    async upsertClassroomTasks(rows) {
      if (rows.length) await run(sb.from('tasks').upsert(rows, { onConflict: 'user_id,classroom_id' }));
    },

    listNotes: () => run(sb.from('notes').select('*').order('note_date', { ascending: false }).order('created_at', { ascending: false })),
    saveNote({ id, course = '', note_date, body = '' }) {
      const row = { course, body, ...(note_date && { note_date }) };
      return id
        ? run(sb.from('notes').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select().single())
        : run(sb.from('notes').insert(row).select().single());
    },
    async deleteNote(id) { await run(sb.from('notes').delete().eq('id', id)); },

    listClasses: () => run(sb.from('classes').select('*').order('weekday').order('start_time')),
    saveClass({ id, ...c }) {
      return id
        ? run(sb.from('classes').update(c).eq('id', id).select().single())
        : run(sb.from('classes').insert(c).select().single());
    },
    async deleteClass(id) { await run(sb.from('classes').delete().eq('id', id)); },

    async moodImages() {
      const me = await uid();
      const files = await run(bucket().list(me));
      const paths = files.filter(f => f.name.includes('.')).map(f => `${me}/${f.name}`);
      if (!paths.length) return {};
      const signed = await run(bucket().createSignedUrls(paths, 3600));
      return Object.fromEntries(signed.filter(s => s.signedUrl).map(s => {
        const name = s.path.split('/').pop();
        return [name.split('.')[0], { url: s.signedUrl, type: TYPES[extOf(name)] || 'image/webp' }];
      }));
    },
    async uploadMoodImage(mood, file) {
      checkMoodFile(file);
      const me = await uid();
      const old = (await run(bucket().list(me))).filter(f => f.name.split('.')[0] === mood).map(f => `${me}/${f.name}`);
      if (old.length) await run(bucket().remove(old));
      const ext = Object.keys(TYPES).find(k => TYPES[k] === file.type) || extOf(file.name) || 'webp';
      await run(bucket().upload(`${me}/${mood}.${ext}`, file, { contentType: file.type, upsert: true }));
    },
  };
}
