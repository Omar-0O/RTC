/// <reference lib="deno.ns" />

import {
  assertCanManageTarget,
  assertJsonRequest,
  corsHeaders,
  createAdminClient,
  getErrorMessage,
  getErrorStatus,
  getRequesterContext,
  getTargetContext,
  httpError,
  json,
} from '../_shared/authz.ts'

interface UpdatePasswordBody {
  userId: string
  newPassword: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    assertJsonRequest(req)

    const { userId, newPassword } = await req.json() as UpdatePasswordBody
    if (!userId || !newPassword) {
      return json({ error: 'userId and newPassword are required', success: false }, 400)
    }

    if (newPassword.length < 6) {
      throw httpError('Password must be at least 6 characters', 400)
    }

    const supabaseAdmin = createAdminClient()
    const requester = await getRequesterContext(req, supabaseAdmin)
    const target = await getTargetContext(supabaseAdmin, userId)

    assertCanManageTarget(requester, target)

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword },
    )

    if (updateError) throw updateError

    return json({ success: true, message: 'Password updated successfully' })
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    console.error('Error in update-user-password:', errorMessage)
    return json({ error: errorMessage, success: false }, getErrorStatus(error))
  }
})
