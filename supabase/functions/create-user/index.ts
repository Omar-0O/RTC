import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, password, fullName, role, committeeId, phone } = await req.json()

        // Create admin client with service role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Check if requester is admin
        const authHeader = req.headers.get('Authorization')!
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: requesterError } = await supabaseAdmin.auth.getUser(token)

        if (requesterError || !requester) {
            throw new Error('Unauthorized')
        }

        const { data: requesterRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', requester.id)
            .single()

        if (requesterRole?.role !== 'admin') {
            throw new Error('Unauthorized: Admin access required')
        }

        // Create the user with email confirmed
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName
            }
        })

        if (createError) throw createError

        // Insert into user_roles
        const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: userData.user.id,
                role: role || 'volunteer'
            })

        if (roleError) throw roleError

        // Update profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: fullName,
                committee_id: committeeId || null,
                phone: phone || null
            })
            .eq('id', userData.user.id)

        if (profileError) throw profileError

        return new Response(
            JSON.stringify({ success: true, user: userData.user }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
