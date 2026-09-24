import { supabase } from './supabaseClient';
import { User, UserRole } from '../types';

// Maps a Supabase `profiles` row (snake_case) into the app's existing User shape (camelCase)
const SYSTEM_CREATOR_EMAIL = 'bebito@nilefleet.com';

function mapProfileToUser(profile: any, email: string): User {
  const normalizedEmail = String(email || profile.email || '').trim().toLowerCase();
  return {
    id: profile.id,
    name: profile.name,
    email: email,
    isCreator: normalizedEmail === SYSTEM_CREATOR_EMAIL,
    role: profile.role as UserRole,
    companyName: profile.company_name,
    companyNameAr: profile.company_name_ar,
    avatarUrl: profile.avatar_url,
    phoneNumber: profile.phone_number,
    jobTitle: profile.job_title,
    department: profile.department,
    joinedDate: profile.joined_date,
    bio: profile.bio,
    assignedPorts: profile.assigned_ports || undefined,
    taxpayerId: profile.taxpayer_id,
    addressLine: profile.address_line,
    governorate: profile.governorate,
    postalCode: profile.postal_code,
    isEtaVerified: profile.is_eta_verified,
    pastOutstandingAmount: profile.past_outstanding_amount || 0,
    revoked: profile.revoked,
    mfaEnabled: profile.mfa_enabled,
    allowedScreens: profile.allowed_screens || undefined,
    permissions: profile.permissions || undefined,
    invoiceSettings: profile.invoice_settings || undefined,
    wipePassword: profile.wipe_password || undefined,
    signatureUrl: profile.signature_url || undefined,
  };
}

export async function loginWithPassword(email: string, password: string): Promise<{ user?: User; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: error?.message || 'Authentication failed' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Could not load user profile' };
  }

  if (profile.revoked) {
    await supabase.auth.signOut();
    return { error: 'REVOKED' };
  }

  return { user: mapProfileToUser(profile, data.user.email || email) };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sessionUser.id)
    .single();

  if (!profile || profile.revoked) return null;

  return mapProfileToUser(profile, sessionUser.email || '');
}

/**
 * Creates a REAL login account (Supabase Auth + profile), via the secure
 * server-side function. Used by User Management when adding a new staff
 * or customer account. Returns an error string on failure.
 */
export async function createRealAccount(email: string, password: string, profile: Partial<User>): Promise<{ userId?: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { error: 'No active administrator session' };

    const res = await fetch('/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, password, profile }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Failed to create account' };
    return { userId: data.userId };
  } catch (e: any) {
    return { error: e?.message || 'Network error creating account' };
  }
}
