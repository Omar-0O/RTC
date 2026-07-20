import {
  assertGlobalAdmin,
  assertJsonRequest,
  corsHeaders,
  createAdminClient,
  getErrorMessage,
  getErrorStatus,
  getRequesterContext,
  json,
} from '../_shared/authz.ts'

interface CreateAdminBody {
  email: string
  password: string
  fullName: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    assertJsonRequest(req)

    const { email, password, fullName } = await req.json() as CreateAdminBody
    if (!email?.trim() || !password || !fullName?.trim()) {
      return json({ error: 'email, password, and fullName are required', success: false }, 400)
    }

    const supabaseAdmin = createAdminClient()
    const requester = await getRequesterContext(req, supabaseAdmin)
    assertGlobalAdmin(requester)

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
      .upsert({ user_id: userData.user.id, role: 'admin' }, { onConflict: 'user_id' })

    if (roleError) throw roleError

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: fullName.trim(), full_name_ar: fullName.trim() })
      .eq('id', userData.user.id)

    if (profileError) throw profileError

    return json({ success: true, user: userData.user })
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    console.error('Error in create-admin:', errorMessage)
    return json({ error: errorMessage, success: false }, getErrorStatus(error))
  }
})
