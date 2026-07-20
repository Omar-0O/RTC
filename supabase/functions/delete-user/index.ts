import {
    assertCanManageTarget,
    assertJsonRequest,
    corsHeaders,
    createAdminClient,
    getErrorMessage,
    getErrorStatus,
    getRequesterContext,
    getTargetContext,
    json,
} from '../_shared/authz.ts'

interface DeleteUserBody {
    userId: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        assertJsonRequest(req)

        const { userId } = await req.json() as DeleteUserBody
        if (!userId) {
            return json({ error: 'User ID is required', success: false }, 400)
        }

        const supabaseAdmin = createAdminClient()
        const requester = await getRequesterContext(req, supabaseAdmin)
        const target = await getTargetContext(supabaseAdmin, userId)

        assertCanManageTarget(requester, target)

        const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (getUserError || !targetUser?.user) {
            throw new Error(`User not found: ${getUserError?.message || 'Unknown user'}`)
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (deleteError) {
            throw new Error(`Failed to delete user: ${deleteError.message}`)
        }

        return json({ success: true, message: 'User deleted successfully' })
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error)
        console.error('Error in delete-user:', errorMessage)
        return json({ error: errorMessage, success: false }, getErrorStatus(error))
    }
})
