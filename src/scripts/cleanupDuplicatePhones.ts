/**
 * @file cleanupDuplicatePhones.ts
 * @description Audit + soft-cleanup script for duplicate phone numbers in users_followup.
 *
 * Run with:
 *   npx tsx src/scripts/cleanupDuplicatePhones.ts
 *
 * What this does:
 *   1. Fetches all records from users_followup.
 *   2. Normalizes all phone numbers using the same E.164 logic as the UI.
 *   3. Detects duplicates PER BRANCH (same phone within the same branch_id).
 *   4. Prints a detailed report to stdout.
 *   5. Optionally flags duplicates as status='duplicate' in the database
 *      (enabled by passing --fix flag).
 *
 * Usage:
 *   npx tsx src/scripts/cleanupDuplicatePhones.ts           # dry-run (report only)
 *   npx tsx src/scripts/cleanupDuplicatePhones.ts --fix     # apply soft-flag to duplicates
 */

import { createClient } from '@supabase/supabase-js';
import { normalizePhoneE164 } from '../utils/phoneUtils';

// ---------------------------------------------------------------------------
// Config — read from env or hard-code for local use
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const DRY_RUN = !process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FollowUpRecord {
  id: number;
  full_name: string;
  phone_1: string;
  phone_2: string | null;
  branch_id: string | null;
  status: string;
  created_at: string;
}

interface DuplicateGroup {
  normalizedPhone: string;
  branch_id: string | null;
  records: FollowUpRecord[];
  keepId: number;   // earliest record — kept as 'approved'
  flagIds: number[]; // the rest — flagged as 'duplicate'
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔍 Fetching records from users_followup…`);

  const { data, error } = await (supabase as any)
    .from('users_followup')
    .select('id, full_name, phone_1, phone_2, branch_id, status, created_at')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌  Supabase fetch error:', error.message);
    process.exit(1);
  }

  const records: FollowUpRecord[] = data || [];
  console.log(`📋  Total records: ${records.length}`);

  // -------------------------------------------------------------------------
  // Group by (normalizedPhone, branch_id) — per-branch scope
  // -------------------------------------------------------------------------
  const groups = new Map<string, FollowUpRecord[]>();

  for (const rec of records) {
    // Check phone_1
    const norm1 = normalizePhoneE164(rec.phone_1);
    if (norm1) {
      const key = `${norm1}||${rec.branch_id ?? '__none__'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }

    // Check phone_2 against phone_1 space and phone_2 space
    if (rec.phone_2) {
      const norm2 = normalizePhoneE164(rec.phone_2);
      if (norm2 && norm2 !== norm1) {
        const key2 = `${norm2}||${rec.branch_id ?? '__none__'}`;
        if (!groups.has(key2)) groups.set(key2, []);
        // Only add if this record isn't already in the group under a different phone
        const existing = groups.get(key2)!;
        if (!existing.find(r => r.id === rec.id)) {
          existing.push(rec);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Identify actual duplicate groups (size > 1)
  // -------------------------------------------------------------------------
  const duplicates: DuplicateGroup[] = [];

  for (const [key, recs] of groups.entries()) {
    if (recs.length < 2) continue;
    const [normalizedPhone, branchPart] = key.split('||');
    const branch_id = branchPart === '__none__' ? null : branchPart;

    // Sort ascending by id (earliest = keep)
    const sorted = [...recs].sort((a, b) => a.id - b.id);
    const keepId = sorted[0].id;
    const flagIds = sorted.slice(1).map(r => r.id);

    duplicates.push({ normalizedPhone, branch_id, records: sorted, keepId, flagIds });
  }

  // -------------------------------------------------------------------------
  // Print report
  // -------------------------------------------------------------------------
  console.log(`\n${'='.repeat(72)}`);
  console.log(`📊  DUPLICATE PHONE REPORT — scope: per-branch`);
  console.log(`    ${DRY_RUN ? '🟡 DRY RUN (no changes applied)' : '🔴 APPLY MODE (--fix)'}`);
  console.log(`${'='.repeat(72)}\n`);

  if (duplicates.length === 0) {
    console.log('✅  No duplicate phone numbers found within any branch. All clear!\n');
    return;
  }

  console.log(`⚠️   Found ${duplicates.length} duplicate group(s):\n`);

  let totalFlagged = 0;

  for (const group of duplicates) {
    console.log(`  📞 Phone: ${group.normalizedPhone}  |  Branch: ${group.branch_id ?? '(no branch)'}`);
    for (const rec of group.records) {
      const marker = rec.id === group.keepId ? '✅ KEEP' : '🚩 FLAG';
      console.log(
        `    ${marker}  id=${rec.id}  name="${rec.full_name}"  status=${rec.status}  created=${rec.created_at.slice(0, 10)}`
      );
    }
    totalFlagged += group.flagIds.length;
    console.log();
  }

  console.log(`Total records to flag: ${totalFlagged}`);

  // -------------------------------------------------------------------------
  // Apply changes if --fix passed
  // -------------------------------------------------------------------------
  if (DRY_RUN) {
    console.log(`\n💡 To apply these changes, run with --fix flag:\n`);
    console.log(`   npx tsx src/scripts/cleanupDuplicatePhones.ts --fix\n`);
    return;
  }

  const allFlagIds = duplicates.flatMap(g => g.flagIds);
  if (allFlagIds.length === 0) {
    console.log('Nothing to update.\n');
    return;
  }

  console.log(`\n🔄 Applying soft-flags to ${allFlagIds.length} records…`);

  const { error: updateError } = await (supabase as any)
    .from('users_followup')
    .update({ status: 'duplicate' })
    .in('id', allFlagIds);

  if (updateError) {
    console.error('❌  Update failed:', updateError.message);
    process.exit(1);
  }

  console.log(`✅  Done — ${allFlagIds.length} record(s) flagged as status='duplicate'.\n`);
  console.log(`   These records still exist and can be reviewed / re-activated by an admin.\n`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
