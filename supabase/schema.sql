-- Student Planner schema. Run once in Supabase SQL Editor.
-- Every row belongs to one user; RLS keeps each person's data private.

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course text not null default '',
  note_date date not null default current_date,
  body text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(trim(title)) > 0),
  course text not null default '',
  due_at timestamptz,
  source text not null check (source in ('manual', 'classroom', 'note')),
  classroom_id text,
  classroom_link text,
  classroom_state text,
  done_manual boolean not null default false,
  hidden boolean not null default false, -- Classroom work the user hid; sync never touches it
  note_id uuid references notes on delete set null,
  created_at timestamptz default now(),
  unique (user_id, classroom_id)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course text not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday, like JS getDay()
  start_time time not null,
  end_time time not null,
  room text not null default '',
  created_at timestamptz default now()
);

alter table notes enable row level security;
alter table tasks enable row level security;
alter table classes enable row level security;

create policy own_notes on notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_tasks on tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_classes on classes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Newer projects don't grant table access by default. Signed-in users only; RLS above still limits them to their own rows.
grant select, insert, update, delete on notes, tasks, classes to authenticated;

-- Private bucket for character pictures: <user_id>/<mood>.<ext>
insert into storage.buckets (id, name, public) values ('characters', 'characters', false);

create policy own_characters_select on storage.objects for select
  using (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_characters_insert on storage.objects for insert
  with check (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_characters_update on storage.objects for update
  using (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy own_characters_delete on storage.objects for delete
  using (bucket_id = 'characters' and (storage.foldername(name))[1] = auth.uid()::text);
