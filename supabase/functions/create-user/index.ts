/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


interface CreateUserBody {
    email: string;
    password?: string;
    fullName?: string;
    role?: string;
    committeeId?: string;
    phone?: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, password, fullName, role, committeeId, phone } = await req.json() as CreateUserBody

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing Supabase environment variables')
        }

        // Create admin client with service role key
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

        // Check if requester is admin
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: requesterError } = await supabaseAdmin.auth.getUser(token)

        if (requesterError || !requester) {
            throw new Error(`Unauthorized: ${requesterError?.message || 'User not found'}`)
        }

        const { data: requesterRole, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', requester.id)
            .maybeSingle()

        if (roleError) {
            throw new Error(`Database error verifying role: ${roleError.message}`)
        }

        if (!requesterRole || requesterRole.role !== 'admin') {
            // Log for debugging (in real logs)
            console.log(`User ${requester.id} attempted to create user but has role: ${requesterRole?.role}`)
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
        const { error: insertRoleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: userData.user.id,
                role: role || 'volunteer'
            })

        if (insertRoleError) throw insertRoleError

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

    } catch (error) {
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
