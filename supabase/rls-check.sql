-- Run in Supabase SQL Editor AFTER schema.sql.
-- It ALWAYS ends with an error on purpose: the error message is the result, and the error rolls everything back.
-- Expected message:  RESULT: PASS (B cannot read A: PASS, B cannot write as A: PASS)
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  seen int;
  read_ok text;
  write_ok text;
begin
  insert into auth.users (id, email, aud, role)
  values (a, 'rls-a@example.test', 'authenticated', 'authenticated'),
         (b, 'rls-b@example.test', 'authenticated', 'authenticated');

  set local role authenticated;

  -- as A: create a task
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into tasks (title, source) values ('A secret task', 'manual');

  -- as B: must see nothing of A
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into seen from tasks;
  read_ok := case when seen = 0 then 'PASS' else 'FAIL' end;

  -- as B: must not be able to write a row owned by A
  begin
    insert into tasks (user_id, title, source) values (a, 'x', 'manual');
    write_ok := 'FAIL';
  exception when insufficient_privilege or check_violation then
    write_ok := 'PASS';
  end;

  raise exception 'RESULT: % (B cannot read A: %, B cannot write as A: %)',
    case when read_ok = 'PASS' and write_ok = 'PASS' then 'PASS' else 'FAIL' end, read_ok, write_ok;
end $$;
