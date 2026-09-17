-- =========================================================
-- SUPABASE DATABASE SETUP
-- Project: cdqsuqndnqfgcmytostj
-- Run this in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.home_sections (
  id uuid primary key default gen_random_uuid(),
  section_type text not null check (section_type in ('slide','info')),
  title text not null,
  body text default '',
  button_text text default '',
  button_url text default '#treatments',
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  disease_name_en text not null,
  disease_name_ne text default '',
  chief_complaints text default '',
  medicines text default '',
  procedure text default '',
  details text default '',
  notes text default '',
  images text[] not null default '{}',
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_sections enable row level security;
alter table public.treatments enable row level security;

-- Public users can read published content.
drop policy if exists "Public can read published home sections" on public.home_sections;
create policy "Public can read published home sections"
on public.home_sections for select
to anon, authenticated
using (published = true);

drop policy if exists "Public can read published treatments" on public.treatments;
create policy "Public can read published treatments"
on public.treatments for select
to anon, authenticated
using (published = true);

-- Authenticated users can manage all content.
-- IMPORTANT: This means every authenticated Supabase user is an admin.
-- For a production multi-user system, replace this with an admin-role check.
drop policy if exists "Authenticated users manage home sections" on public.home_sections;
create policy "Authenticated users manage home sections"
on public.home_sections for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users manage treatments" on public.treatments;
create policy "Authenticated users manage treatments"
on public.treatments for all
to authenticated
using (true)
with check (true);

-- Optional: sample home data
insert into public.home_sections(section_type,title,body,button_text,button_url,sort_order)
values
('slide','Welcome to the Treatment Guide','Disease information, chief complaints, medicines and doctor treatment procedures in one place.','View Treatments','#treatments',1),
('info','About','This website is an offline-ready reference. Content is managed from the Supabase admin panel.', '', '#',2)
on conflict do nothing;

-- =========================================================
-- OPTIONAL IMAGE STORAGE
-- =========================================================
-- Create a Storage bucket named "treatment-images" in:
-- Supabase Dashboard -> Storage -> New bucket.
--
-- For the simplest setup, make the bucket public and paste its
-- public image URLs into the treatment Images field.
--
-- For stricter security, use authenticated upload policies and
-- signed URLs instead.
