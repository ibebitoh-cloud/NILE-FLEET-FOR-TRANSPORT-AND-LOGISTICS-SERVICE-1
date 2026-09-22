// Cloudflare Pages Function: creates a REAL Supabase Auth account (with a real
// login) plus its profile row, using the secret service-role key. This key can
// only ever live here — server-side — never in the browser bundle. Reachable
// at /create-user once deployed.

import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, password, profile } = body;
  if (!email || !password || !profile) {
    return json({ error: 'email, password and profile are required' }, 400);
  }
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  // Admin client — only ever instantiated here, server-side, with the secret key
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Only an authenticated administrator (or delegated user manager) may create accounts.
  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return json({ error: 'Administrator authentication required' }, 401);

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  if (callerError || !callerData?.user) return json({ error: 'Invalid administrator session' }, 401);

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('profiles')
    .select('role, permissions, revoked')
    .eq('id', callerData.user.id)
    .single();
  if (callerProfileError || !callerProfile || callerProfile.revoked) {
    return json({ error: 'Administrator profile not found or revoked' }, 403);
  }
  const canManageUsers = callerProfile.role === 'ADMIN' || callerProfile.permissions?.canManageUsers === true;
  if (!canManageUsers) return json({ error: 'You do not have permission to create users' }, 403);

  // 1. Create the real login account
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: profile.name },
  });

  if (createError || !created?.user) {
    return json({ error: createError?.message || 'Failed to create account' }, 400);
  }

  const userId = created.user.id;

  // 2. Upsert the application profile. This does not depend on a signup trigger.
  const profileRow = toSnakeProfile({ ...profile, id: userId });
  delete profileRow.email;
  delete profileRow.password;
  delete profileRow.wipe_password;

  const { error: updateError } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });
  if (updateError) {
    // Account exists but profile fields didn't fully apply — still return success
    // with a warning, since the login itself was created correctly.
    return json({ userId, email, warning: `Profile fields partially applied: ${updateError.message}` });
  }

  return json({ userId, email });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}


function toSnakeProfile(profile) {
  const map = {
    id:'id', name:'name', email:'email', role:'role', companyName:'company_name', companyNameAr:'company_name_ar',
    avatarUrl:'avatar_url', phoneNumber:'phone_number', jobTitle:'job_title', department:'department', joinedDate:'joined_date',
    bio:'bio', assignedPorts:'assigned_ports', taxpayerId:'taxpayer_id', addressLine:'address_line', governorate:'governorate',
    postalCode:'postal_code', isEtaVerified:'is_eta_verified', pastOutstandingAmount:'past_outstanding_amount', revoked:'revoked',
    mfaEnabled:'mfa_enabled', allowedScreens:'allowed_screens', permissions:'permissions', invoiceSettings:'invoice_settings',
    signatureUrl:'signature_url', isServiceAccount:'is_service_account', apiKeys:'api_keys', lastRotationDate:'last_rotation_date',
    passwordHistory:'password_history'
  };
  const out = {};
  for (const [key,value] of Object.entries(profile || {})) if (map[key] && value !== undefined) out[map[key]] = value;
  return out;
}
