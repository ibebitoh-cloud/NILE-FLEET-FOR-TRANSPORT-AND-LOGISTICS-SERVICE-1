-- Restore the profile field used by the application for service-account filtering.
alter table public.profiles
  add column if not exists is_service_account boolean not null default false;
