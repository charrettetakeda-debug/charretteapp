-- E-mails que viram administradores (papel 'equipe') automaticamente ao se cadastrar
create table privado.emails_equipe (
  email      text primary key,
  created_at timestamptz not null default now()
);
insert into privado.emails_equipe (email) values ('charrette.takeda@gmail.com');

create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    case when exists (select 1 from privado.emails_equipe e where lower(e.email) = lower(new.email))
         then 'equipe' else 'charretteiro' end
  );
  return new;
end $$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

update public.perfis p set papel = 'equipe'
from auth.users u
where u.id = p.id and lower(u.email) in (select lower(email) from privado.emails_equipe);
