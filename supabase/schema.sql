-- =====================================================================
-- ОТП Мания: база данных в Supabase.
-- Запустите целиком в Supabase → SQL Editor → New query → Run.
-- Скрипт можно запускать повторно: он ничего не удаляет.
-- =====================================================================

-- Отправка писем из базы (уведомления). В Supabase расширение уже есть, его нужно только включить.
create extension if not exists pg_net;

-- Все данные приложения: одна строка на запись (пользователь, начисление, заказ…).
create table if not exists public.docs (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  primary key (collection, id)
);
create index if not exists docs_updated_at_idx on public.docs (updated_at);
create index if not exists docs_users_auth_idx on public.docs ((data->>'authId')) where collection = 'users';

-- Секреты (ключ почтового сервиса). Схема private недоступна из браузера.
create schema if not exists private;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on schema private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema private from anon, authenticated'; end if;
end $$;

-- База уже заполнена стартовыми данными?
create or replace function public.is_seeded() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.docs where collection = 'meta' and id = 'main');
$$;

-- Текущий пользователь администратор программы?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.docs
    where collection = 'users' and not deleted
      and data->>'authId' = auth.uid()::text and data->>'role' = 'admin');
$$;

-- Защита: роли, настройки и справочники меняет только администратор.
create or replace function public.docs_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();

  -- Из SQL Editor и сервисных ключей можно всё; правила действуют для запросов из браузера.
  if v_role not in ('anon', 'authenticated') then return new; end if;
  -- До первой инициализации первый клиент заливает стартовые данные.
  if not public.is_seeded() then return new; end if;

  -- При upsert существующей записи проверку делает ветка UPDATE.
  if tg_op = 'INSERT' and exists (select 1 from public.docs d where d.collection = new.collection and d.id = new.id) then
    return new;
  end if;

  if new.collection in ('settings', 'departments', 'signalStatus', 'meta', 'news', 'goals', 'articles') and not public.is_admin() then
    raise exception 'Только администратор может менять настройки программы' using errcode = '42501';
  end if;

  if new.collection = 'users' and not public.is_admin() then
    if tg_op = 'INSERT' then
      if coalesce(new.data->>'role', 'employee') <> 'employee' or new.data->>'authId' is distinct from auth.uid()::text then
        raise exception 'Только администратор может создавать пользователей с ролью' using errcode = '42501';
      end if;
    elsif old.data->>'role' is distinct from new.data->>'role'
       or old.data->>'authId' is distinct from new.data->>'authId'
       or old.data->>'email' is distinct from new.data->>'email' then
      raise exception 'Только администратор может менять роли' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists docs_guard on public.docs;
create trigger docs_guard before insert or update on public.docs
for each row execute function public.docs_guard();

-- Письмо на почту при каждом новом уведомлении (через Brevo).
create or replace function public.docs_notify_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_key text; v_sender text; v_site text; v_email text; v_name text; v_text text; v_link text;
begin
  if new.collection <> 'notifications' or new.deleted then return new; end if;
  select value into v_key    from private.settings where key = 'brevo_api_key';
  select value into v_sender from private.settings where key = 'sender_email';
  select value into v_site   from private.settings where key = 'site_url';
  if v_key is null or v_sender is null then return new; end if;

  select data->>'email', data->>'name' into v_email, v_name
  from public.docs where collection = 'users' and id = new.data->>'userId';
  if v_email is null or v_email like '%@mania.demo' then return new; end if;

  v_text := coalesce(new.data->>'text', 'Новое уведомление');
  v_link := coalesce(v_site, '') || '#' || coalesce(new.data->>'link', '/cabinet');
  begin
    perform net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', v_key, 'Content-Type', 'application/json', 'accept', 'application/json'),
      body := jsonb_build_object(
        'sender', jsonb_build_object('name', 'ОТП Мания', 'email', v_sender),
        'to', jsonb_build_array(jsonb_build_object('email', v_email, 'name', coalesce(v_name, ''))),
        'subject', 'ОТП Мания: ' || left(v_text, 70),
        'htmlContent',
          '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:16px">'
          || '<div style="display:inline-block;background:#c1ff05;border-radius:8px;padding:6px 12px;font-weight:700">ОТП Мания</div>'
          || '<p style="font-size:16px;color:#16161a;margin-top:20px">' || replace(replace(v_text, '<', '&lt;'), '>', '&gt;') || '</p>'
          || '<a href="' || v_link || '" style="display:inline-block;margin-top:12px;background:#16161a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px">Открыть в ОТП Мании</a>'
          || '<p style="font-size:12px;color:#8a8a96;margin-top:24px">Письмо отправлено автоматически. Прототип команды для кейс-чемпионата.</p></div>'
      )
    );
  exception when others then
    null; -- письмо не должно мешать сохранению данных
  end;
  return new;
end $$;

drop trigger if exists docs_notify_email on public.docs;
create trigger docs_notify_email after insert on public.docs
for each row execute function public.docs_notify_email();

-- Доступ: читать могут вошедшие пользователи, список подразделений нужен для регистрации.
alter table public.docs enable row level security;
drop policy if exists docs_select on public.docs;
drop policy if exists docs_select_departments on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
create policy docs_select on public.docs for select to authenticated using (true);
create policy docs_select_departments on public.docs for select to anon using (collection = 'departments');
create policy docs_insert on public.docs for insert to authenticated with check (true);
create policy docs_update on public.docs for update to authenticated using (true) with check (true);
grant select on public.docs to anon;
grant select, insert, update on public.docs to authenticated;

-- Назначить администратора (запускать из SQL Editor): select public.make_admin('почта@пример.ru');
create or replace function public.make_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.docs set data = jsonb_set(data, '{role}', '"admin"')
  where collection = 'users' and lower(data->>'email') = lower(trim(p_email));
  if not found then
    raise exception 'Пользователь % не найден. Сначала зарегистрируйтесь и войдите на сайт хотя бы раз', p_email;
  end if;
  return 'Готово: ' || p_email || ' теперь администратор';
end $$;
revoke execute on function public.make_admin(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke execute on function public.make_admin(text) from anon, authenticated'; end if;
end $$;
