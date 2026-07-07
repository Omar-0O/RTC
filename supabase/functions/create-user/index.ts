/// <reference lib="deno.ns" />

import {
    assertCanAssignRole,
    assertCanCreateUsers,
    assertDelegatedRequesterHasBranch,
    assertJsonRequest,
    corsHeaders,
    createAdminClient,
    getErrorMessage,
    getErrorStatus,
    getRequesterContext,
    isGlobalAdmin,
    json,
    normalizeRole,
} from '../_shared/authz.ts'

interface CreateUserBody {
    email: string;
    password?: string;
    fullName?: string;
    fullNameAr?: string;
    role?: string;
    committeeId?: string;
    phone?: string;
    level?: string;
    joinDate?: string;
    isAshbal?: boolean;
    /** Only global admins can set this; otherwise inherited from requester */
    branchId?: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        assertJsonRequest(req)

        let body: CreateUserBody
        try {
            body = await req.json() as CreateUserBody
        } catch {
            throw new Error('Invalid JSON body')
        }

        const {
            email,
            password,
            fullName,
            fullNameAr,
            role,
            committeeId,
            phone,
            level,
            joinDate,
            isAshbal,
            branchId,
        } = body

        if (!email?.trim() || !password || !fullName?.trim()) {
            return json({ error: 'email, password, and fullName are required', success: false }, 400)
        }

        const requestedRole = normalizeRole(role)
        const supabaseAdmin = createAdminClient()
        const requester = await getRequesterContext(req, supabaseAdmin)

        assertCanCreateUsers(requester)
        assertCanAssignRole(requester, requestedRole)
        assertDelegatedRequesterHasBranch(requester)

        const effectiveBranchId = isGlobalAdmin(requester.roles) && branchId
            ? branchId
            : requester.branchId

        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName.trim(),
            },
        })

        if (createError) throw createError

        const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .upsert({
                user_id: userData.user.id,
                role: requestedRole,
            }, { onConflict: 'user_id' })

        if (roleError) throw roleError

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: fullName.trim(),
                full_name_ar: fullNameAr?.trim() || fullName.trim(),
                committee_id: (committeeId === 'general' ? null : committeeId) || null,
                phone: phone || null,
                level: level || 'under_follow_up',
                join_date: joinDate || undefined,
                is_ashbal: isAshbal || false,
                branch_id: effectiveBranchId,
            })
            .eq('id', userData.user.id)

        if (profileError) throw profileError

        return json({ success: true, user: userData.user })
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error)
        console.error('Error in create-user:', errorMessage)
        return json({ error: errorMessage, success: false }, getErrorStatus(error))
    }
})
