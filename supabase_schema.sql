-- Create profiles table linked to Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  role text check (role in ('doctor', 'parent', 'patient')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create patients table
create table public.patients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create notes table
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.notes enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Policies for patients
create policy "Doctors can view their assigned patients."
  on patients for select
  using ( auth.uid() = doctor_id );

create policy "Doctors can insert patients."
  on patients for insert
  with check ( auth.uid() = doctor_id );

-- Policies for notes
create policy "Doctors can view notes for their patients."
  on notes for select
  using ( exists (
    select 1 from patients 
    where patients.id = notes.patient_id 
    and patients.doctor_id = auth.uid()
  ) );

create policy "Doctors can insert notes for their patients."
  on notes for insert
  with check ( exists (
    select 1 from patients 
    where patients.id = notes.patient_id 
    and patients.doctor_id = auth.uid()
  ) );
