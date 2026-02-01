/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdatePasswordBody {
  userId: string;
  newPassword: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, newPassword } = await req.json() as UpdatePasswordBody

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Check if requester is admin or head_hr
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // Create admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the requester's token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requester }, error: requesterError } = await supabaseAdmin.auth.getUser(token)

    if (requesterError || !requester) {
      throw new Error(`Unauthorized: ${requesterError?.message || 'No user found'}`)
    }

    // Verify requester role
    const { data: requesterRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requester.id)

    if (roleError) throw roleError

    const roles = requesterRoles?.map(r => r.role) || []
    const isAuthorized = roles.includes('admin') || roles.includes('head_hr') || roles.includes('supervisor')

    if (!isAuthorized) {
      throw new Error('Unauthorized: Admin or HR access required')
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) throw updateError

    // Store visible password for admin reference
    const { error: privateDetailsError } = await supabaseAdmin
      .from('user_private_details')
      .upsert({
        id: userId,
        visible_password: newPassword
      }, { onConflict: 'id' })

    if (privateDetailsError) {
      console.warn('Failed to update visible password:', privateDetailsError.message)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Error in update-user-password:', error)
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
})
