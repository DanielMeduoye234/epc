import type { SupabaseClient } from '@supabase/supabase-js';
import { Member, NewBeliever } from './types';
import { phonesOverlap, isLikelySamePerson } from './flock';

export interface NewBelieverSyncRecord {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  phone_number: string;
  address?: string;
  bacenta?: string;
  who_brought?: string;
  date_saved?: string;
  birthday?: string | null;
  branch_id: string;
  photo_url?: string | null;
  created_at?: string;
}

/**
 * Synchronize all new believers in a branch into the members table.
 * Deduplicates by direct link (new_believer_id), overlapping phone numbers,
 * or matching full names within the branch so no person is duplicated.
 */
export async function syncNewBelieversToMembers(
  supabase: SupabaseClient,
  branchId: string
): Promise<{ added: number; updated: number }> {
  if (!branchId) return { added: 0, updated: 0 };

  const [nbRes, memRes] = await Promise.all([
    supabase
      .from('new_believers')
      .select('*')
      .eq('branch_id', branchId),
    supabase
      .from('members')
      .select('id, full_name, phone_number, first_timer_id, new_believer_id, branch_id')
      .eq('branch_id', branchId),
  ]);

  if (nbRes.error || memRes.error) {
    console.error('Error fetching data for believer sync:', nbRes.error || memRes.error);
    return { added: 0, updated: 0 };
  }

  const newBelievers: NewBelieverSyncRecord[] = nbRes.data || [];
  const existingMembers = memRes.data || [];

  if (newBelievers.length === 0) return { added: 0, updated: 0 };

  let added = 0;
  let updated = 0;

  for (const nb of newBelievers) {
    // 1. Check if already linked via new_believer_id
    const alreadyLinked = existingMembers.find((m) => m.new_believer_id === nb.id);
    if (alreadyLinked) {
      continue;
    }

    // 2. Check if a member row exists with matching phone or name
    const existingMatch = existingMembers.find(
      (m) =>
        phonesOverlap(m.phone_number, nb.phone_number) ||
        isLikelySamePerson(m, nb) ||
        m.full_name.toLowerCase().trim() === nb.full_name.toLowerCase().trim()
    );

    if (existingMatch) {
      // Link the existing member to this new believer record (prevents duplication)
      const { error: updateErr } = await supabase
        .from('members')
        .update({ new_believer_id: nb.id })
        .eq('id', existingMatch.id);

      if (!updateErr) {
        existingMatch.new_believer_id = nb.id;
        updated++;
      }
      continue;
    }

    // 3. Not found: Insert as new member
    const today = new Date().toISOString().split('T')[0];
    const newMemberPayload = {
      new_believer_id: nb.id,
      full_name: nb.full_name.trim(),
      first_name: nb.first_name || nb.full_name.split(' ')[0] || null,
      last_name: nb.last_name || nb.full_name.split(' ').slice(1).join(' ') || null,
      nickname: nb.nickname || null,
      address: nb.address?.trim() || 'To be updated',
      bacenta: nb.bacenta?.trim() || 'Unassigned',
      phone_number: nb.phone_number.trim(),
      who_brought: nb.who_brought?.trim() || 'To be updated',
      date_joined: nb.date_saved || today,
      membership_date: nb.date_saved || today,
      branch_id: branchId,
      status: 'active',
      birthday: nb.birthday || null,
      photo_url: nb.photo_url || null,
      created_at: nb.created_at || new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('members')
      .insert(newMemberPayload)
      .select('id, full_name, phone_number, first_timer_id, new_believer_id, branch_id')
      .single();

    if (!insertErr && inserted) {
      existingMembers.push(inserted);
      added++;
    }
  }

  return { added, updated };
}

/**
 * Synchronize a single new believer to members immediately upon form save or update.
 */
export async function syncSingleNewBelieverToMember(
  supabase: SupabaseClient,
  nb: NewBelieverSyncRecord
): Promise<void> {
  if (!nb.branch_id || !nb.id) return;

  const { data: existingMembers, error } = await supabase
    .from('members')
    .select('id, full_name, phone_number, new_believer_id')
    .eq('branch_id', nb.branch_id);

  if (error || !existingMembers) return;

  // Check if member already linked or matches
  const match = existingMembers.find(
    (m) =>
      m.new_believer_id === nb.id ||
      phonesOverlap(m.phone_number, nb.phone_number) ||
      isLikelySamePerson(m, nb) ||
      m.full_name.toLowerCase().trim() === nb.full_name.toLowerCase().trim()
  );

  const today = new Date().toISOString().split('T')[0];

  if (match) {
    // Update existing member
    await supabase
      .from('members')
      .update({
        new_believer_id: nb.id,
        full_name: nb.full_name.trim(),
        first_name: nb.first_name || nb.full_name.split(' ')[0] || null,
        last_name: nb.last_name || nb.full_name.split(' ').slice(1).join(' ') || null,
        nickname: nb.nickname || null,
        phone_number: nb.phone_number.trim(),
        address: nb.address?.trim() || undefined,
        bacenta: nb.bacenta?.trim() || undefined,
        who_brought: nb.who_brought?.trim() || undefined,
        birthday: nb.birthday || null,
      })
      .eq('id', match.id);
  } else {
    // Insert new member
    await supabase.from('members').insert({
      new_believer_id: nb.id,
      full_name: nb.full_name.trim(),
      first_name: nb.first_name || nb.full_name.split(' ')[0] || null,
      last_name: nb.last_name || nb.full_name.split(' ').slice(1).join(' ') || null,
      nickname: nb.nickname || null,
      address: nb.address?.trim() || 'To be updated',
      bacenta: nb.bacenta?.trim() || 'Unassigned',
      phone_number: nb.phone_number.trim(),
      who_brought: nb.who_brought?.trim() || 'To be updated',
      date_joined: nb.date_saved || today,
      membership_date: nb.date_saved || today,
      branch_id: nb.branch_id,
      status: 'active',
      birthday: nb.birthday || null,
      photo_url: nb.photo_url || null,
    });
  }
}

/**
 * Merge demo new believers into demo members without duplication.
 */
export function mergeNewBelieversIntoDemoMembers(
  demoMembers: Member[],
  demoNewBelievers: NewBeliever[]
): Member[] {
  const result = [...demoMembers];

  for (const nb of demoNewBelievers) {
    const exists = result.some(
      (m) =>
        m.new_believer_id === nb.id ||
        phonesOverlap(m.phone_number, nb.phone_number) ||
        isLikelySamePerson(m, nb) ||
        m.full_name.toLowerCase().trim() === nb.full_name.toLowerCase().trim()
    );

    if (!exists) {
      result.push({
        id: `m-nb-${nb.id}`,
        first_timer_id: null,
        new_believer_id: nb.id,
        full_name: nb.full_name,
        first_name: nb.first_name,
        last_name: nb.last_name,
        nickname: nb.nickname,
        address: nb.address,
        bacenta: nb.bacenta,
        phone_number: nb.phone_number,
        who_brought: nb.who_brought,
        date_joined: nb.date_saved,
        membership_date: nb.date_saved,
        assigned_shepherd: null,
        branch_id: nb.branch_id,
        status: 'active',
        photo_url: nb.photo_url,
        birthday: nb.birthday,
        created_at: nb.created_at,
      });
    }
  }

  return result;
}
