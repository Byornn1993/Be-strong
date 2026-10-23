-- Alleen voor LOKALE ontwikkeling (supabase db reset). Draait nooit op productie.
-- Standaardoefeningen en meettypes zitten in de migraties, zodat ook productie ze krijgt.
-- Twee testgebruikers voor de e2e- en RLS-tests (wachtwoord: zie tests/e2e/fixtures.ts).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'test-a@bestrong.test', crypt('test-password-a', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'test-b@bestrong.test', crypt('test-password-b', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a',
   '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","email":"test-a@bestrong.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-00000000000b',
   '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","email":"test-b@bestrong.test"}', 'email', now(), now(), now())
on conflict do nothing;
