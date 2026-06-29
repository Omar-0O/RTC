import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type AppRole =
  | 'admin'
  | 'executive'
  | 'branch_admin'
  | 'head_hr'
  | 'hr'
  | 'supervisor'
  | 'committee_leader'
  | 'volunteer'
  | 'head_production'
  | 'head_fourth_year'
  | 'head_caravans'
  | 'head_events'
  | 'head_ethics'
  | 'head_quran'
  | 'head_ashbal'
  | 'head_marketing'
  | 'marketing_member'

export type SupabaseAdminClient = SupabaseClient

export interface RequesterContext {
  id: string
  roles: AppRole[]
  branchId: string | null
}

export interface TargetContext {
  id: string
  roles: AppRole[]
  branchId: string | null
  isAshbal: boolean
}

const GLOBAL_ADMIN_ROLES = new Set<AppRole>(['admin', 'executive'])
const USER_CREATE_ROLES = new Set<AppRole>([
  'admin',
  'executive',
  'head_hr',
  'branch_admin',
  'supervisor',
  'head_ashbal',
])
const DELEGATED_TARGET_ROLES = new Set<AppRole>([
  'volunteer',
  'committee_leader',
  'marketing_member',
])

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

export function assertJsonRequest(req: Request): void {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw httpError('Content-Type must be application/json', 415)
  }
}

export function httpError(message: string, status = 400): Error & { status: number } {
  const error = new Error(message) as Error & { status: number }
  error.status = status
  return error
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return 400
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

export function createAdminClient(): SupabaseAdminClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw httpError('Missing Supabase environment variables', 500)
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getRequesterContext(
  req: Request,
  supabaseAdmin: SupabaseAdminClient,
): Promise<RequesterContext> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    throw httpError('Missing or invalid Authorization bearer token', 401)
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    throw httpError('Missing Authorization bearer token', 401)
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    throw httpError(`Unauthorized: ${userError?.message || 'No user found'}`, 401)
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  if (roleError) {
    throw httpError(`Database error verifying role: ${roleError.message}`, 500)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('branch_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw httpError(`Database error verifying profile: ${profileError.message}`, 500)
  }

  return {
    id: user.id,
    roles: (roleRows?.map((row: { role: AppRole }) => row.role) || []) as AppRole[],
    branchId: profile?.branch_id ?? null,
  }
}

export async function getTargetContext(
  supabaseAdmin: SupabaseAdminClient,
  targetUserId: string,
): Promise<TargetContext> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('branch_id, is_ashbal')
    .eq('id', targetUserId)
    .maybeSingle()

  if (profileError) {
    throw httpError(`Database error verifying target profile: ${profileError.message}`, 500)
  }

  if (!profile) {
    throw httpError('Target user profile not found', 404)
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)

  if (roleError) {
    throw httpError(`Database error verifying target role: ${roleError.message}`, 500)
  }

  return {
    id: targetUserId,
    roles: (roleRows?.map((row: { role: AppRole }) => row.role) || []) as AppRole[],
    branchId: profile.branch_id ?? null,
    isAshbal: Boolean(profile.is_ashbal),
  }
}

export function isGlobalAdmin(roles: AppRole[]): boolean {
  return roles.some((role) => GLOBAL_ADMIN_ROLES.has(role))
}

export function assertGlobalAdmin(requester: RequesterContext): void {
  if (!isGlobalAdmin(requester.roles)) {
    throw httpError('Forbidden: global admin access required', 403)
  }
}

export function assertCanCreateUsers(requester: RequesterContext): void {
  if (!requester.roles.some((role) => USER_CREATE_ROLES.has(role))) {
    throw httpError('Forbidden: user creation access required', 403)
  }
}

export function normalizeRole(role: string | undefined): AppRole {
  return (role || 'volunteer') as AppRole
}

export function assertCanAssignRole(requester: RequesterContext, targetRole: AppRole): void {
  if (isGlobalAdmin(requester.roles)) return

  if (!DELEGATED_TARGET_ROLES.has(targetRole)) {
    throw httpError('Forbidden: only global admins can assign privileged roles', 403)
  }
}

export function assertSameBranch(requester: RequesterContext, target: TargetContext): void {
  if (!requester.branchId || !target.branchId || requester.branchId !== target.branchId) {
    throw httpError('Forbidden: target user is outside your branch scope', 403)
  }
}

export function hasProtectedRole(target: TargetContext): boolean {
  return target.roles.some((role) => !DELEGATED_TARGET_ROLES.has(role))
}

export function assertCanManageTarget(
  requester: RequesterContext,
  target: TargetContext,
  options: { requireAshbalTarget?: boolean } = {},
): void {
  if (requester.id === target.id) {
    throw httpError('Forbidden: you cannot manage your own account through this endpoint', 403)
  }

  if (isGlobalAdmin(requester.roles)) return

  assertSameBranch(requester, target)

  if (options.requireAshbalTarget && !target.isAshbal) {
    throw httpError('Forbidden: target user is not an ashbal account', 403)
  }

  if (hasProtectedRole(target)) {
    throw httpError('Forbidden: only global admins can manage privileged accounts', 403)
  }
}
