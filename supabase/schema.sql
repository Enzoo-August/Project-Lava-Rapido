-- =====================================================================
--  Lava Rápido — banco de dados (Supabase / PostgreSQL)
--  UM banco para TODOS os lava-rápidos: cada linha tem "lava_id" e as
--  regras de segurança (RLS) garantem que um lava nunca vê o outro.
--
--  Perfis:  admin        = quem vende o sistema (cria e libera os lavas)
--           dono         = vê e altera tudo do próprio lava
--           funcionario  = registra chegada, andamento e entrega
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.lavas (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nome          text not null,
  marca         jsonb not null default '{}',   -- logo, cores, telefone, endereço, link do Google (informação pública)
  config        jsonb not null default '{}',   -- fidelidade, mensagens, formas de pagamento, lavadores
  ativo         boolean not null default true, -- assinatura em dia
  plano         text not null default 'mensal',
  pago_ate      date,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  lava_id       uuid references public.lavas(id) on delete cascade,   -- vazio só para o admin
  nome          text not null,
  login         text not null unique,
  perfil        text not null check (perfil in ('admin', 'dono', 'funcionario')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (perfil = 'admin' or lava_id is not null)
);
create index if not exists perfis_lava on public.perfis(lava_id);

create table if not exists public.servicos (
  id            uuid primary key default gen_random_uuid(),
  lava_id       uuid not null references public.lavas(id) on delete cascade,
  nome          text not null,
  precos        jsonb not null default '{}',   -- preço por porte: {"moto":25,"p":40,"m":50,"g":60,"x":70}
  minutos       int not null default 30,
  ordem         int not null default 0,
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now()
);
create index if not exists servicos_lava on public.servicos(lava_id, atualizado_em);

create table if not exists public.clientes (
  id                  uuid primary key default gen_random_uuid(),
  lava_id             uuid not null references public.lavas(id) on delete cascade,
  nome                text not null,
  telefone            text,                     -- só números, com DDD
  obs                 text,
  -- os cinco campos abaixo são calculados pelo banco a partir dos atendimentos
  visitas             int not null default 0,
  pontos_usados       int not null default 0,
  gasto               numeric not null default 0,
  primeira_visita     timestamptz,
  ultima_visita       timestamptz,
  avaliacao_pedida_em timestamptz,              -- quando pedimos a avaliação no Google
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists clientes_lava on public.clientes(lava_id, atualizado_em);

create table if not exists public.veiculos (
  lava_id          uuid not null references public.lavas(id) on delete cascade,
  placa            text not null,               -- sem traço, maiúscula (ou SEM-xxxx para carro sem placa)
  cliente_id       uuid references public.clientes(id),
  marca            text,
  modelo           text,
  cor              text,
  porte            text not null default 'm' check (porte in ('moto', 'p', 'm', 'g', 'x')),
  obs              text,
  -- calculados pelo banco
  visitas          int not null default 0,
  ultima_visita    timestamptz,
  ultimos_servicos jsonb,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  primary key (lava_id, placa)
);
create index if not exists veiculos_lava on public.veiculos(lava_id, atualizado_em);
create index if not exists veiculos_cliente on public.veiculos(cliente_id);

create table if not exists public.atendimentos (
  id             uuid primary key default gen_random_uuid(),
  lava_id        uuid not null references public.lavas(id) on delete cascade,
  numero         int,                           -- ficha do dia (1, 2, 3…), dada pelo banco
  placa          text not null,
  veiculo        text,                          -- "Fiesta prata" (cópia para mostrar rápido)
  cliente_id     uuid references public.clientes(id),
  servicos       jsonb not null default '[]',   -- [{id, nome, valor}]
  valor          numeric not null default 0,
  desconto       numeric not null default 0,
  total          numeric not null default 0,
  pontos_usados  int not null default 0,        -- fidelidade usada neste atendimento
  premio         text,
  status         text not null default 'aguardando' check (status in ('aguardando', 'lavando', 'pronto', 'entregue', 'cancelado')),
  pagamento      text,
  previsao       timestamptz,
  obs            text,
  cliente_novo   boolean not null default false, -- primeira vez do cliente (o banco confere)
  token          text unique,                    -- link de acompanhamento do cliente
  entrada_em     timestamptz not null default now(),
  inicio_em      timestamptz,
  pronto_em      timestamptz,
  entregue_em    timestamptz,
  cancelado_em   timestamptz,
  avisado_em     timestamptz,                    -- avisou no WhatsApp que ficou pronto
  atendente      uuid default auth.uid(),
  atendente_nome text,
  lavador        text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists atend_lava_entrada on public.atendimentos(lava_id, entrada_em);
create index if not exists atend_lava_atualizado on public.atendimentos(lava_id, atualizado_em);
create index if not exists atend_cliente on public.atendimentos(cliente_id);
create index if not exists atend_placa on public.atendimentos(lava_id, placa);

create table if not exists public.despesas (
  id            uuid primary key default gen_random_uuid(),
  lava_id       uuid not null references public.lavas(id) on delete cascade,
  data          date not null,
  categoria     text,
  descricao     text,
  valor         numeric not null default 0,
  excluido      boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create index if not exists despesas_lava on public.despesas(lava_id, data);

-- ---------------------------------------------------------------------
-- Funções de apoio para as regras de segurança
-- ---------------------------------------------------------------------
create or replace function public.meu_perfil() returns text
language sql stable security definer set search_path = public as
$$ select perfil from public.perfis where user_id = auth.uid() and ativo $$;

create or replace function public.meu_lava() returns uuid
language sql stable security definer set search_path = public as
$$ select lava_id from public.perfis where user_id = auth.uid() and ativo $$;

create or replace function public.eh_dono() returns boolean
language sql stable set search_path = public as $$ select coalesce(public.meu_perfil() = 'dono', false) $$;

create or replace function public.eh_admin() returns boolean
language sql stable set search_path = public as $$ select coalesce(public.meu_perfil() = 'admin', false) $$;

-- assinatura em dia? (lava desativado continua lendo, mas não grava)
create or replace function public.lava_ativo() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select ativo from public.lavas where id = public.meu_lava()), false) $$;

-- ---------------------------------------------------------------------
-- Regras automáticas
-- ---------------------------------------------------------------------
-- carimbo de "atualizado em" (os aparelhos buscam só o que mudou desde a última vez)
create or replace function public.carimbar() returns trigger
language plpgsql set search_path = public as $$ begin new.atualizado_em = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['lavas', 'perfis', 'servicos', 'clientes', 'veiculos', 'atendimentos', 'despesas']
  loop
    execute format('drop trigger if exists carimbar on public.%I', t);
    execute format('create trigger carimbar before insert or update on public.%I for each row execute function public.carimbar()', t);
  end loop;
end $$;

-- o dono altera nome, marca e configurações; assinatura e endereço (slug) só o admin
create or replace function public.lavas_guarda() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.eh_admin() and pg_trigger_depth() = 1 and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.slug := old.slug; new.ativo := old.ativo; new.plano := old.plano; new.pago_ate := old.pago_ate; new.criado_em := old.criado_em;
  end if;
  return new;
end $$;
drop trigger if exists lavas_guarda on public.lavas;
create trigger lavas_guarda before update on public.lavas for each row execute function public.lavas_guarda();

-- contadores do cliente e do veículo: só o banco calcula (ninguém "se dá" lavagens)
create or replace function public.contadores_guarda() returns trigger
language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if tg_table_name = 'clientes' then
    if tg_op = 'INSERT' then
      new.visitas := 0; new.pontos_usados := 0; new.gasto := 0; new.primeira_visita := null; new.ultima_visita := null;
    else
      new.visitas := old.visitas; new.pontos_usados := old.pontos_usados; new.gasto := old.gasto;
      new.primeira_visita := old.primeira_visita; new.ultima_visita := old.ultima_visita; new.lava_id := old.lava_id;
    end if;
  else
    if tg_op = 'INSERT' then
      new.visitas := 0; new.ultima_visita := null; new.ultimos_servicos := null;
    else
      new.visitas := old.visitas; new.ultima_visita := old.ultima_visita; new.ultimos_servicos := old.ultimos_servicos;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists contadores_guarda on public.clientes;
create trigger contadores_guarda before insert or update on public.clientes for each row execute function public.contadores_guarda();
drop trigger if exists contadores_guarda on public.veiculos;
create trigger contadores_guarda before insert or update on public.veiculos for each row execute function public.contadores_guarda();

-- atendimento novo: ficha do dia e "é a primeira vez deste cliente?"
create or replace function public.atend_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare dia date;
begin
  if tg_op = 'INSERT' then
    dia := (new.entrada_em at time zone 'America/Sao_Paulo')::date;
    perform pg_advisory_xact_lock(hashtext(new.lava_id::text));
    select coalesce(max(numero), 0) + 1 into new.numero from public.atendimentos
      where lava_id = new.lava_id and entrada_em >= (dia::timestamp at time zone 'America/Sao_Paulo')
        and entrada_em < ((dia + 1)::timestamp at time zone 'America/Sao_Paulo');
    new.cliente_novo := new.cliente_id is not null and not exists (
      select 1 from public.atendimentos where cliente_id = new.cliente_id and status <> 'cancelado' and id <> new.id);
    if new.token is null then new.token := replace(gen_random_uuid()::text, '-', ''); end if;
  else
    new.lava_id := old.lava_id; new.numero := old.numero; new.cliente_novo := old.cliente_novo; new.token := old.token;
  end if;
  new.total := greatest(coalesce(new.valor, 0) - coalesce(new.desconto, 0), 0);
  return new;
end $$;
drop trigger if exists atend_antes on public.atendimentos;
create trigger atend_antes before insert or update on public.atendimentos for each row execute function public.atend_antes();

-- depois de cada atendimento: refaz os contadores do cliente e do veículo a partir do histórico
create or replace function public.recalcular(p_cliente uuid, p_lava uuid, p_placa text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_cliente is not null then
    update public.clientes c
       set visitas = a.v, pontos_usados = a.p, gasto = a.g, primeira_visita = a.pv, ultima_visita = a.uv
      from (select count(*) filter (where status <> 'cancelado')::int as v,
                   coalesce(sum(pontos_usados) filter (where status <> 'cancelado'), 0)::int as p,
                   coalesce(sum(total) filter (where status = 'entregue'), 0) as g,
                   min(entrada_em) filter (where status <> 'cancelado') as pv,
                   max(entrada_em) filter (where status <> 'cancelado') as uv
              from public.atendimentos where cliente_id = p_cliente) a
     where c.id = p_cliente
       and (c.visitas, c.pontos_usados, c.gasto, c.primeira_visita, c.ultima_visita) is distinct from (a.v, a.p, a.g, a.pv, a.uv);
  end if;
  if p_placa is not null then
    update public.veiculos v
       set visitas = a.v, ultima_visita = a.uv, ultimos_servicos = a.s
      from (select count(*)::int as v, max(entrada_em) as uv,
                   (select servicos from public.atendimentos where lava_id = p_lava and placa = p_placa and status <> 'cancelado' order by entrada_em desc limit 1) as s
              from public.atendimentos where lava_id = p_lava and placa = p_placa and status <> 'cancelado') a
     where v.lava_id = p_lava and v.placa = p_placa
       and (v.visitas, v.ultima_visita, v.ultimos_servicos) is distinct from (a.v, a.uv, a.s);
  end if;
end $$;

create or replace function public.atend_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular(new.cliente_id, new.lava_id, new.placa);
  if tg_op = 'UPDATE' and (old.cliente_id is distinct from new.cliente_id or old.placa <> new.placa) then
    perform public.recalcular(old.cliente_id, old.lava_id, old.placa);
  end if;
  return null;
end $$;
drop trigger if exists atend_depois on public.atendimentos;
create trigger atend_depois after insert or update on public.atendimentos for each row execute function public.atend_depois();

-- ---------------------------------------------------------------------
-- Segurança por lava e por perfil (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.lavas        enable row level security;
alter table public.perfis       enable row level security;
alter table public.servicos     enable row level security;
alter table public.clientes     enable row level security;
alter table public.veiculos     enable row level security;
alter table public.atendimentos enable row level security;
alter table public.despesas     enable row level security;

do $$
declare t text; p text;
begin
  for t, p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', p, t);
  end loop;
end $$;

-- lavas: cada um vê o seu; o dono altera nome/marca/configurações (assinatura fica travada pelo gatilho)
create policy ver on public.lavas for select to authenticated using (id = (select public.meu_lava()) or (select public.eh_admin()));
create policy editar on public.lavas for update to authenticated
  using ((id = (select public.meu_lava()) and (select public.eh_dono())) or (select public.eh_admin()))
  with check ((id = (select public.meu_lava()) and (select public.eh_dono())) or (select public.eh_admin()));

-- perfis: cada um vê o seu e os colegas do mesmo lava; alterações só pelas funções de acesso
create policy ver on public.perfis for select to authenticated
  using (user_id = (select auth.uid()) or lava_id = (select public.meu_lava()) or (select public.eh_admin()));

-- serviços e preços: todos do lava veem; só o dono altera
create policy ver on public.servicos for select to authenticated using (lava_id = (select public.meu_lava()));
create policy criar on public.servicos for insert to authenticated
  with check (lava_id = (select public.meu_lava()) and (select public.eh_dono()) and (select public.lava_ativo()));
create policy editar on public.servicos for update to authenticated
  using (lava_id = (select public.meu_lava()) and (select public.eh_dono()))
  with check (lava_id = (select public.meu_lava()) and (select public.eh_dono()) and (select public.lava_ativo()));

-- clientes e veículos: todos do lava veem e cadastram (nada é apagado: só desativado)
create policy ver on public.clientes for select to authenticated using (lava_id = (select public.meu_lava()));
create policy criar on public.clientes for insert to authenticated
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));
create policy editar on public.clientes for update to authenticated
  using (lava_id = (select public.meu_lava()))
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));

create policy ver on public.veiculos for select to authenticated using (lava_id = (select public.meu_lava()));
create policy criar on public.veiculos for insert to authenticated
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));
create policy editar on public.veiculos for update to authenticated
  using (lava_id = (select public.meu_lava()))
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));

-- atendimentos: o dono vê tudo; o funcionário só o que está no pátio e o movimento recente
-- (o histórico de faturamento fica só com o dono)
create policy ver on public.atendimentos for select to authenticated
  using (lava_id = (select public.meu_lava())
         and ((select public.eh_dono()) or status in ('aguardando', 'lavando', 'pronto') or entrada_em > now() - interval '36 hours'));
create policy criar on public.atendimentos for insert to authenticated
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));
create policy editar on public.atendimentos for update to authenticated
  using (lava_id = (select public.meu_lava())
         and ((select public.eh_dono()) or status in ('aguardando', 'lavando', 'pronto') or entrada_em > now() - interval '36 hours'))
  with check (lava_id = (select public.meu_lava()) and (select public.lava_ativo()));

-- despesas: só o dono
create policy tudo on public.despesas for all to authenticated
  using (lava_id = (select public.meu_lava()) and (select public.eh_dono()))
  with check (lava_id = (select public.meu_lava()) and (select public.eh_dono()) and (select public.lava_ativo()));

-- permissões das tabelas: só quem fez login; ninguém apaga nada pelo aplicativo
revoke all on public.lavas, public.perfis, public.servicos, public.clientes, public.veiculos, public.atendimentos, public.despesas from anon, authenticated;
grant select, update on public.lavas to authenticated;
grant select on public.perfis to authenticated;
grant select, insert, update on public.servicos, public.clientes, public.veiculos, public.atendimentos, public.despesas to authenticated;

-- ---------------------------------------------------------------------
-- Funções públicas (sem login): marca do lava na tela de entrada e
-- acompanhamento do carro pelo cliente
-- ---------------------------------------------------------------------
create or replace function public.marca(p_slug text) returns jsonb
language sql stable security definer set search_path = public as
$$ select jsonb_build_object('nome', nome, 'marca', marca, 'slug', slug) from public.lavas where slug = lower(trim(p_slug)) $$;

create or replace function public.acompanhar(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lava', l.nome, 'marca', l.marca, 'fidelidade', l.config -> 'fidelidade',
    'numero', a.numero, 'status', a.status, 'veiculo', a.veiculo, 'placa', a.placa,
    'servicos', (select coalesce(jsonb_agg(s ->> 'nome'), '[]'::jsonb) from jsonb_array_elements(a.servicos) s),
    'total', a.total, 'previsao', a.previsao, 'entrada_em', a.entrada_em, 'pronto_em', a.pronto_em, 'entregue_em', a.entregue_em,
    'nome', split_part(coalesce(c.nome, ''), ' ', 1),
    'saldo', greatest(coalesce(c.visitas, 0) - coalesce(c.pontos_usados, 0), 0))
  from public.atendimentos a
  join public.lavas l on l.id = a.lava_id
  left join public.clientes c on c.id = a.cliente_id
  where length(coalesce(p_token, '')) >= 12 and a.token = p_token
$$;

-- ---------------------------------------------------------------------
-- Acessos (logins)
-- ---------------------------------------------------------------------
create or replace function public.login_limpo(p_login text) returns text
language sql immutable set search_path = public as $$ select lower(trim(coalesce(p_login, ''))) $$;

-- cria o usuário de login (uso interno das funções abaixo)
create or replace function public.novo_usuario(p_login text, p_senha text, p_nome text, p_perfil text, p_lava uuid) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); v_login text := public.login_limpo(p_login); v_email text;
begin
  if v_login !~ '^[a-z0-9._-]{3,30}$' then raise exception 'O usuário deve ter de 3 a 30 letras ou números, sem espaço'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter 6 caracteres ou mais'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome'; end if;
  v_email := v_login || '@lava.local';
  if exists (select 1 from public.perfis where login = v_login) or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Esse usuário já existe. Escolha outro.';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nome', p_nome), now(), now(),
          '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  insert into public.perfis (user_id, lava_id, nome, login, perfil) values (uid, p_lava, trim(p_nome), v_login, p_perfil);
  return uid;
end $$;

create or replace function public.ha_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfis where perfil = 'admin') $$;

-- primeiro acesso: cria o administrador (só funciona enquanto não existir nenhum)
create or replace function public.primeiro_admin(p_login text, p_senha text, p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if public.ha_admin() then raise exception 'O administrador já foi criado'; end if;
  return public.novo_usuario(p_login, p_senha, p_nome, 'admin', null);
end $$;

-- serviços de exemplo para um lava novo (o dono ajusta nomes e preços depois)
create or replace function public.servicos_padrao(p_lava uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.servicos (lava_id, nome, precos, minutos, ordem) values
    (p_lava, 'Lavagem simples',      '{"moto":20,"p":40,"m":50,"g":60,"x":70}',       30, 1),
    (p_lava, 'Lavagem completa',     '{"moto":35,"p":60,"m":70,"g":85,"x":100}',      50, 2),
    (p_lava, 'Lavagem com cera',     '{"moto":45,"p":80,"m":95,"g":110,"x":130}',     70, 3),
    (p_lava, 'Lavagem detalhada',    '{"moto":80,"p":180,"m":220,"g":260,"x":300}',  180, 4),
    (p_lava, 'Higienização interna', '{"moto":0,"p":200,"m":240,"g":280,"x":320}',   240, 5),
    (p_lava, 'Lavagem de motor',     '{"moto":20,"p":50,"m":50,"g":60,"x":70}',       30, 6);
$$;

-- ADMIN: cria um lava-rápido novo já com o login do dono e os serviços de exemplo
create or replace function public.admin_criar_lava(p_nome text, p_slug text, p_dono_nome text, p_login text, p_senha text, p_pago_ate date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_slug text := lower(trim(p_slug));
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode criar um lava-rápido'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome do lava-rápido'; end if;
  if v_slug !~ '^[a-z0-9-]{3,40}$' then raise exception 'O endereço deve ter de 3 a 40 letras minúsculas, números ou traço'; end if;
  if exists (select 1 from public.lavas where slug = v_slug) then raise exception 'Já existe um lava-rápido com esse endereço'; end if;
  insert into public.lavas (slug, nome, pago_ate) values (v_slug, trim(p_nome), p_pago_ate) returning id into v_id;
  perform public.servicos_padrao(v_id);
  perform public.novo_usuario(p_login, p_senha, p_dono_nome, 'dono', v_id);
  return v_id;
end $$;

create or replace function public.admin_editar_lava(p_id uuid, p_nome text, p_ativo boolean, p_plano text, p_pago_ate date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode alterar a assinatura'; end if;
  update public.lavas set nome = coalesce(nullif(trim(p_nome), ''), nome), ativo = coalesce(p_ativo, ativo),
         plano = coalesce(nullif(p_plano, ''), plano), pago_ate = p_pago_ate where id = p_id;
end $$;

create or replace function public.admin_lavas()
returns table (id uuid, slug text, nome text, ativo boolean, plano text, pago_ate date, criado_em timestamptz,
               dono text, clientes bigint, carros_30d bigint, ultimo_movimento timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.slug, l.nome, l.ativo, l.plano, l.pago_ate, l.criado_em,
         (select string_agg(p.nome || ' (' || p.login || ')', ', ') from public.perfis p where p.lava_id = l.id and p.perfil = 'dono' and p.ativo),
         (select count(*) from public.clientes c where c.lava_id = l.id),
         (select count(*) from public.atendimentos a where a.lava_id = l.id and a.status <> 'cancelado' and a.entrada_em > now() - interval '30 days'),
         (select max(a.entrada_em) from public.atendimentos a where a.lava_id = l.id)
  from public.lavas l where public.eh_admin() order by l.criado_em desc
$$;

-- DONO: logins da equipe do próprio lava
create or replace function public.criar_acesso(p_login text, p_senha text, p_nome text, p_perfil text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_dono() then raise exception 'Só o dono pode criar acessos'; end if;
  if p_perfil not in ('dono', 'funcionario') then raise exception 'Perfil inválido'; end if;
  return public.novo_usuario(p_login, p_senha, p_nome, p_perfil, public.meu_lava());
end $$;

create or replace function public.editar_acesso(p_user uuid, p_nome text, p_perfil text, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.perfis;
begin
  select * into v from public.perfis where user_id = p_user;
  if v.user_id is null or not public.eh_dono() or v.lava_id is distinct from public.meu_lava() then raise exception 'Sem permissão'; end if;
  if p_perfil not in ('dono', 'funcionario') then raise exception 'Perfil inválido'; end if;
  if v.perfil = 'dono' and v.ativo and (p_perfil <> 'dono' or not p_ativo)
     and (select count(*) from public.perfis where lava_id = v.lava_id and perfil = 'dono' and ativo) < 2 then
    raise exception 'Precisa existir pelo menos um dono ativo';
  end if;
  update public.perfis set nome = coalesce(nullif(trim(p_nome), ''), nome), perfil = p_perfil, ativo = coalesce(p_ativo, ativo) where user_id = p_user;
end $$;

create or replace function public.trocar_senha_acesso(p_user uuid, p_senha text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v public.perfis;
begin
  select * into v from public.perfis where user_id = p_user;
  if v.user_id is null then raise exception 'Acesso não encontrado'; end if;
  if not (p_user = auth.uid() or public.eh_admin() or (public.eh_dono() and v.lava_id = public.meu_lava())) then raise exception 'Sem permissão'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter 6 caracteres ou mais'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- quem pode chamar cada função (o Supabase libera para todos por padrão)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.meu_perfil(), public.meu_lava(), public.eh_dono(), public.eh_admin(), public.lava_ativo() to authenticated;
grant execute on function public.marca(text), public.acompanhar(text), public.ha_admin() to anon, authenticated;
grant execute on function public.primeiro_admin(text, text, text) to anon, authenticated;
grant execute on function public.admin_criar_lava(text, text, text, text, text, date), public.admin_editar_lava(uuid, text, boolean, text, date), public.admin_lavas() to authenticated;
grant execute on function public.criar_acesso(text, text, text, text), public.editar_acesso(uuid, text, text, boolean), public.trocar_senha_acesso(uuid, text) to authenticated;
