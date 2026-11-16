import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '../..');
const POSTGRES_SKILL_PATH = path.join(REPO_ROOT, '.agents/skills/postgres/SKILL.md');
const POSTGRES_REFERENCES_DIR = path.join(REPO_ROOT, '.agents/skills/postgres/references');
const AUDIT_MIGRATION_PATH = path.join(
  REPO_ROOT,
  'supabase/migrations/20261116130000_planetscale_postgres_audit_optimizations.sql',
);

function extractFunctionBody(sql: string, fnSignature: string): string {
  const start = sql.indexOf(fnSignature);
  if (start === -1) return '';
  const tail = sql.slice(start);
  const endMarker = tail.search(/\n\$\$;|\n\$hardening\$;/);
  return endMarker === -1 ? tail : tail.slice(0, endMarker);
}

describe('PlanetScale PostgreSQL skill installation & audit migration', () => {
  it('installs the PlanetScale postgres skill and core reference files', () => {
    expect(existsSync(POSTGRES_SKILL_PATH)).toBe(true);
    const skillContent = readFileSync(POSTGRES_SKILL_PATH, 'utf8');
    expect(skillContent.trim().length).toBeGreaterThan(0);
    expect(skillContent).toContain('name: postgres');

    for (const refFile of [
      'indexing.md',
      'index-optimization.md',
      'schema-design.md',
      'query-patterns.md',
      'mvcc-transactions.md',
      'optimization-checklist.md',
    ]) {
      expect(existsSync(path.join(POSTGRES_REFERENCES_DIR, refFile))).toBe(true);
    }
  });

  it('installs the selected database skills from antonrisch/db-skills without redundant schema boilerplate', () => {
    for (const skillName of ['write-safe-migrations', 'data-quality-audit', 'debug-slow-queries']) {
      const skillPath = path.join(REPO_ROOT, '.agents/skills', skillName, 'SKILL.md');
      expect(existsSync(skillPath)).toBe(true);
      const content = readFileSync(skillPath, 'utf8');
      expect(content.trim().length).toBeGreaterThan(0);
      expect(content).toContain(`name: ${skillName}`);
    }

    expect(existsSync(path.join(REPO_ROOT, '.agents/skills/query-database-schema'))).toBe(false);
  });

  it('wraps the audit migration in an explicit transaction', () => {
    expect(existsSync(AUDIT_MIGRATION_PATH)).toBe(true);
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');
    expect(sql).toMatch(/\bBEGIN;/);
    expect(sql.trimEnd()).toMatch(/\bCOMMIT;$/);
  });

  it('drops the redundant prefix index and creates expected FK/composite indexes idempotently', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('DROP INDEX IF EXISTS public.idx_profiles_is_active;');

    const expectedIndexes = [
      'idx_activity_submissions_volunteer_status_submitted',
      'idx_activity_submissions_committee_status_submitted',
      'idx_activity_submissions_branch_status_submitted',
      'idx_activity_submissions_trainer_activity_type',
      'idx_activity_submissions_activity_type_id',
      'idx_activity_submissions_group_submission_id',
      'idx_activity_submissions_reviewed_by',
      'idx_profiles_committee_id',
      'idx_profiles_branch_active',
      'idx_volunteer_fines_volunteer_paid',
      'idx_volunteer_feedbacks_volunteer_id',
      'idx_courses_committee_id',
      'idx_courses_trainer_id',
      'idx_courses_room_schedule',
      'idx_course_lectures_course_number',
      'idx_course_attendance_lecture_id',
      'idx_course_organizers_course_id',
      'idx_course_trainers_trainer_id',
      'idx_trainer_lecture_records_lecture_id',
      'idx_trainer_lecture_records_course_id',
      'idx_trainer_lecture_records_volunteer_id',
      'idx_trainers_committee_id',
      'idx_trainers_user_id',
      'idx_caravan_participants_caravan_id',
      'idx_caravan_participants_volunteer_id',
      'idx_group_submissions_leader_id',
      'idx_group_submissions_committee_id',
    ];

    for (const indexName of expectedIndexes) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
    }
  });

  it('fixes trigger functions for manual volunteer levels, atomic delete, and badge/branch fast-paths', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    const approvalFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.update_user_points_on_approval()');
    expect(approvalFn).not.toBe('');
    expect(approvalFn).not.toContain('calculate_level');
    expect(approvalFn).toContain('NEW.volunteer_id IS NULL');

    const deleteFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.deduct_points_on_submission_delete()');
    expect(deleteFn).not.toBe('');
    expect(deleteFn).not.toContain('SELECT total_points INTO');
    expect(deleteFn).toContain('UPDATE public.profiles');

    const badgeFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.auto_award_badges()');
    expect(badgeFn).toContain('IF NOT EXISTS (SELECT 1 FROM public.badges WHERE auto_award = true)');
    expect(badgeFn).toContain('needs_caravans');

    const branchFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.auto_set_branch_id()');
    expect(branchFn).toContain('pg_trigger_depth() > 1');
  });

  it('fixes double-counting in award_ethics_call_points and optimizes monthly dismissal and leaderboard RPCs', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    const ethicsFn = extractFunctionBody(
      sql,
      'CREATE OR REPLACE FUNCTION public.award_ethics_call_points(participants jsonb)',
    );
    expect(ethicsFn).toContain('INSERT INTO public.activity_submissions');
    expect(ethicsFn).not.toContain('UPDATE public.profiles');

    const dismissalFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.run_monthly_auto_dismissal(');
    expect(dismissalFn).toContain('approved_counts AS');
    expect(dismissalFn).toContain('unpaid_fines AS');

    const leaderboardFn = extractFunctionBody(sql, 'CREATE OR REPLACE FUNCTION public.get_leaderboard(');
    expect(leaderboardFn).toContain('end_date_exclusive');
    expect(leaderboardFn).toContain('submission_stats AS');
    expect(leaderboardFn).not.toContain("interval '1 second'");
  });

  it('uses InitPlan scalar subqueries in RLS helpers and hot-path policies', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.has_leadership_role()');
    expect(sql).toContain('(SELECT auth.uid())');
    expect(sql).toContain('(SELECT public.is_admin_or_exec())');
    expect(sql).toContain('(SELECT public.get_my_branch_id())');
    expect(sql).toContain('(SELECT public.has_leadership_role())');
    expect(sql).toContain('ON public.profiles');
    expect(sql).toContain('ON public.activity_submissions');
    expect(sql).toContain('ON public.volunteer_fines');
  });

  it('applies safe-migration timeouts, planner ANALYZE refreshes, and post-migration data quality checks', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    expect(sql).toContain("SET LOCAL lock_timeout = '5s';");
    expect(sql).toContain("SET LOCAL statement_timeout = '60s';");
    expect(sql).toContain('ANALYZE public.activity_submissions;');
    expect(sql).toContain('ANALYZE public.profiles;');
    expect(sql).toContain('ANALYZE public.volunteer_fines;');
    expect(sql).toContain('SECTION E: POST-MIGRATION VERIFICATION & DATA QUALITY AUDIT');
    expect(sql).toContain('Data quality audit:');
  });

  it('drops duplicate FK constraints and adds remaining FK/source-tracking indexes', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('DROP CONSTRAINT IF EXISTS users_followup_linked_to_fkey;');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS fk_session_circle;');

    for (const indexName of [
      'idx_activity_submissions_source',
      'idx_activity_submissions_fine_type_id',
      'idx_activity_types_committee_id',
      'idx_event_participants_event_id',
      'idx_event_participants_volunteer_id',
      'idx_ethics_calls_participants_call_id',
      'idx_ethics_calls_participants_volunteer_id',
      'idx_competition_entries_participant_id',
      'idx_quran_circles_teacher_id',
      'idx_quran_circles_organizer_id',
      'idx_quran_circle_beneficiaries_beneficiary_id',
      'idx_quran_progress_history_beneficiary_id',
      'idx_quran_teachers_user_id',
      'idx_user_badges_badge_id',
      'idx_users_followup_linked_to',
      'idx_volunteer_feedbacks_author_id',
      'idx_volunteer_fines_fine_type_id',
      'idx_volunteer_fines_created_by',
      'idx_rooms_branch_id',
    ]) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
    }
  });

  it('hardens Quran session triggers and get_trainer_stats and fixes Quran RLS column shadowing', () => {
    const sql = readFileSync(AUDIT_MIGRATION_PATH, 'utf8');

    for (const fnSig of [
      'CREATE OR REPLACE FUNCTION public.log_quran_session_activity()',
      'CREATE OR REPLACE FUNCTION public.delete_quran_session_activity()',
      'CREATE OR REPLACE FUNCTION public.get_trainer_stats(p_trainer_id UUID)',
    ]) {
      const body = extractFunctionBody(sql, fnSig);
      expect(body).not.toBe('');
      expect(body).toContain('SET search_path = public, pg_temp');
    }

    const trainerStatsBody = extractFunctionBody(
      sql,
      'CREATE OR REPLACE FUNCTION public.get_trainer_stats(p_trainer_id UUID)',
    );
    expect(trainerStatsBody).toContain('public.course_trainers');

    expect(sql).toContain('o.circle_id = public.quran_enrollments.circle_id');
    expect(sql).toContain('o.circle_id = public.quran_circle_sessions.circle_id');
    expect(sql).toContain('o.circle_id = public.quran_circle_beneficiaries.circle_id');
  });
});
