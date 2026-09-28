-- Security hardening: managers may manage roster data, but only ADMIN can change
-- authorization-sensitive profile fields (including role/revocation/permissions).
-- Also remove the retired wipe_password reference from the trigger.

create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  -- A non-admin caller can never change authorization-sensitive fields on any profile.
  if not private.is_admin() then
    new.role := old.role;
    new.revoked := old.revoked;
    new.allowed_screens := old.allowed_screens;
    new.permissions := old.permissions;
    new.assigned_ports := old.assigned_ports;
    new.company_name := old.company_name;
    new.company_name_ar := old.company_name_ar;
    new.past_outstanding_amount := old.past_outstanding_amount;
    new.is_eta_verified := old.is_eta_verified;
    new.mfa_enabled := old.mfa_enabled;
    new.taxpayer_id := old.taxpayer_id;
    new.invoice_settings := old.invoice_settings;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_identity_fields() from public, anon, authenticated;

-- Correct the wipe reset value to the actual genset_status enum value.
create or replace function public.admin_total_system_wipe()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  delete from public.payment_allocations;
  delete from public.operations;
  delete from public.invoices;
  delete from public.payments;
  delete from public.procurement;
  delete from public.gas_transactions;
  delete from public.payroll_transactions;
  delete from public.food_expenses;
  delete from public.transport_expenses;
  delete from public.port_rents;
  delete from public.reservations;
  delete from public.customer_prices;
  delete from public.system_notifications;
  delete from public.profiles where role = 'CUSTOMER';
  update public.gensets set status = 'IN_STOCK'::public.genset_status;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_total_system_wipe() from public, anon;
grant execute on function public.admin_total_system_wipe() to authenticated;
