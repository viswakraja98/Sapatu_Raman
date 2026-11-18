-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
create table if not exists profiles (
  id uuid primary key, name text not null, emoji text, color text, sort int default 0,
  calorie_goal int, start_weight numeric, goal_weight numeric, plan_start date,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists recipes (
  id uuid primary key, name text not null, url text, video text, category text,
  kcal numeric, protein numeric, ingredients text, steps text, notes text, tags text,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists plan_items (
  id uuid primary key, profile_id uuid not null references profiles(id) on delete cascade,
  date date not null, slot int not null, sort bigint default 0,
  title text not null, details text, recipe_id uuid references recipes(id) on delete set null,
  kcal numeric, kcal_est boolean default false, source text, swapped_from text,
  status text not null default 'planned', actual text, actual_kcal numeric, note text,
  updated_at timestamptz default now()
);
create index if not exists plan_items_profile_date on plan_items(profile_id, date);
create table if not exists weights (
  id uuid primary key, profile_id uuid not null references profiles(id) on delete cascade,
  date date not null, kg numeric not null, updated_at timestamptz default now()
);

-- Only signed-in users (your family account) can read or change anything.
alter table profiles enable row level security;
alter table recipes enable row level security;
alter table plan_items enable row level security;
alter table weights enable row level security;
do $$ declare t text; begin
  foreach t in array array['profiles','recipes','plan_items','weights'] loop
    execute format('drop policy if exists family_all on %I', t);
    execute format('create policy family_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Let the signed-in family account use the tables through the API.
grant usage on schema public to authenticated;
grant select, insert, update, delete on profiles, recipes, plan_items, weights to authenticated;

-- Live updates between phones.
do $$ declare t text; begin
  foreach t in array array['profiles','recipes','plan_items','weights'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
