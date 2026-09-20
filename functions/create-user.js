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

  // Admin client — only ever instantiated here, server-side, with the secret key
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  // 2. The DB trigger auto-creates a default CUSTOMER profile row on signup.
  //    Overwrite it with the actual fields the admin specified (role, company, etc).
  const profileUpdate = { ...profile };
  delete profileUpdate.id;
  delete profileUpdate.email;
  delete profileUpdate.password; // never store plaintext passwords

  const { error: updateError } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
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
