/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserBody {
    userId: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId } = await req.json() as DeleteUserBody

        if (!userId) {
            throw new Error('User ID is required')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
            const missingVars: string[] = [];
            if (!supabaseUrl) missingVars.push('SUPABASE_URL');
            if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
            throw new Error(`Missing Supabase environment variables: ${missingVars.join(', ')}`)
        }

        // Check if requester is admin or head_hr
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
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

        // Verify the requester's token
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: requesterError } = await supabaseAdmin.auth.getUser(token)

        if (requesterError || !requester) {
            console.error('User check failed:', requesterError?.message || 'No user returned')
            throw new Error(`Unauthorized (User Check): ${requesterError?.message || 'Auth session missing!'}`)
        }

        // Prevent self-deletion
        if (requester.id === userId) {
            throw new Error('Cannot delete your own account')
        }

        const { data: requesterRoles, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', requester.id)

        if (roleError) {
            throw new Error(`Database error verifying role: ${roleError.message}`)
        }

        const roles = requesterRoles?.map(r => r.role) || []
        const isAuthorized = roles.includes('admin') || roles.includes('head_hr')

        if (!isAuthorized) {
            console.log(`User ${requester.id} attempted to delete user but has roles: ${roles.join(', ')}`)
            throw new Error(`Unauthorized: Admin or HR access required. User roles are: ${roles.join(', ') || 'none'}`)
        }

        // Check if target user exists
        const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (getUserError || !targetUser?.user) {
            throw new Error(`User not found: ${getUserError?.message || 'Unknown user'}`)
        }

        // Delete user from auth.users (this will cascade delete from profiles if FK is set up)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
            throw new Error(`Failed to delete user: ${deleteError.message}`)
        }

        console.log(`User ${userId} successfully deleted by ${requester.id}`)

        return new Response(
            JSON.stringify({ success: true, message: 'User deleted successfully' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Error in delete-user:', errorMessage)

        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    }
})
