import { createClient } from '@supabase/supabase-js';

// Pipeline database — contacts, stages, audit log
const pipelineUrl = process.env.REACT_APP_PIPELINE_URL;
const pipelineKey = process.env.REACT_APP_PIPELINE_ANON_KEY;

// Investors database — LP registry, KYC, secure records
const investorsUrl = process.env.REACT_APP_INVESTORS_URL;
const investorsKey = process.env.REACT_APP_INVESTORS_ANON_KEY;

export const pipelineDb = createClient(pipelineUrl, pipelineKey);
export const investorsDb = createClient(investorsUrl, investorsKey);

// ── AUTH ──────────────────────────────────────────────────────
export const signIn = async (email, password) => {
  const { data, error } = await pipelineDb.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  await pipelineDb.auth.signOut();
};

export const getCurrentUser = async () => {
  const { data: { user } } = await pipelineDb.auth.getUser();
  return user;
};

export const getCurrentProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await pipelineDb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
};

// ── CONTACTS ─────────────────────────────────────────────────
export const getContacts = async () => {
  const { data, error } = await pipelineDb
    .from('contacts')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createContact = async (contact, userId) => {
  const { data, error } = await pipelineDb
    .from('contacts')
    .insert([{ ...contact, created_by: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateContact = async (id, updates) => {
  const { data, error } = await pipelineDb
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteContact = async (id) => {
  const { error } = await pipelineDb
    .from('contacts')
    .update({ is_deleted: true })
    .eq('id', id);
  if (error) throw error;
};

// ── STAGE CHANGES ────────────────────────────────────────────
export const moveStage = async (contactId, fromStage, toStage, userId) => {
  // Update contact stage
  const { data, error } = await pipelineDb
    .from('contacts')
    .update({ stage: toStage, updated_at: new Date().toISOString() })
    .eq('id', contactId)
    .select()
    .single();
  if (error) throw error;

  // Log stage change
  await pipelineDb.from('stage_history').insert([{
    contact_id: contactId,
    from_stage: fromStage,
    to_stage: toStage,
    changed_by: userId,
  }]);

  // Write audit log
  await pipelineDb.from('audit_log').insert([{
    action: 'stage_change',
    contact_id: contactId,
    performed_by: userId,
    details: { from: fromStage, to: toStage },
  }]);

  return data;
};

// ── PROMOTION TO INVESTED ────────────────────────────────────
export const requestPromotion = async (contactId, userId, details) => {
  const { data, error } = await pipelineDb
    .from('promotion_requests')
    .insert([{
      contact_id: contactId,
      requested_by: userId,
      status: 'pending',
      ...details,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const approvePromotion = async (requestId, contactId, userId, profile) => {
  // 1. Get the contact snapshot
  const { data: contact } = await pipelineDb
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  // 2. Get the promotion request
  const { data: request } = await pipelineDb
    .from('promotion_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  // 3. Write to investors database
  const { data: lpRecord, error: lpError } = await investorsDb
    .from('lp_registry')
    .insert([{
      pipeline_contact_id: contactId,
      promoted_by_email: profile.email,
      full_name: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      firm: contact.firm,
      city: contact.city,
      share_class: request.share_class,
      commitment_amount: request.commitment_amount,
      accreditation_status: request.accreditation_status,
      notes: request.notes,
    }])
    .select()
    .single();
  if (lpError) throw lpError;

  // 4. Write promotion log to investors database
  await investorsDb.from('promotion_log').insert([{
    lp_id: lpRecord.id,
    pipeline_contact_id: contactId,
    pipeline_request_id: requestId,
    approved_by_email: profile.email,
    contact_snapshot: contact,
  }]);

  // 5. Update pipeline contact
  await pipelineDb.from('contacts').update({
    stage: 'invested',
    promoted_to_invested_at: new Date().toISOString(),
    promoted_by: userId,
    lp_registry_id: lpRecord.id,
  }).eq('id', contactId);

  // 6. Approve the request
  await pipelineDb.from('promotion_requests').update({
    status: 'approved',
    approved_by: userId,
    approved_at: new Date().toISOString(),
  }).eq('id', requestId);

  // 7. Audit log
  await pipelineDb.from('audit_log').insert([{
    action: 'promote',
    contact_id: contactId,
    performed_by: userId,
    details: { lp_registry_id: lpRecord.id, request_id: requestId },
  }]);

  return lpRecord;
};

// ── STATS ────────────────────────────────────────────────────
export const getPipelineStats = async () => {
  const { data, error } = await pipelineDb
    .from('contacts')
    .select('stage, last_contact_date')
    .eq('is_deleted', false);
  if (error) throw error;

  const today = new Date();
  const stats = {
    suspect: 0,
    prospect: 0,
    engagement: 0,
    invested: 0,
    overdue: 0,
  };

  data.forEach(c => {
    stats[c.stage] = (stats[c.stage] || 0) + 1;
    const lastContact = new Date(c.last_contact_date);
    const days = Math.floor((today - lastContact) / 86400000);
    if (days >= 30) stats.overdue++;
  });

  return stats;
};
