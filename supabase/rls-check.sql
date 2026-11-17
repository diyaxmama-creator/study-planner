-- Run in Supabase SQL Editor AFTER schema.sql. Everything is rolled back.
-- Expected: the two "check" rows say PASS; nothing is left behind.
begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'rls-a@example.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'rls-b@example.test', 'authenticated', 'authenticated');

create temp table rls_result (name text, result text) on commit drop;
grant all on rls_result to authenticated;

set local role authenticated;

-- as A: create a task
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into tasks (title, source) values ('A secret task', 'manual');

-- as B: must see nothing of A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into rls_result
  select 'B cannot read A', case when count(*) = 0 then 'PASS' else 'FAIL' end from tasks;

-- as B: must not be able to write a row owned by A
do $$
begin
  insert into tasks (user_id, title, source) values ('00000000-0000-0000-0000-00000000000a', 'x', 'manual');
  insert into rls_result values ('B cannot write as A', 'FAIL');
exception when insufficient_privilege or check_violation then
  insert into rls_result values ('B cannot write as A', 'PASS');
end $$;

select * from rls_result;
rollback;
