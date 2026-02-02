
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // validate content type
        const contentType = req.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
            throw new Error('Content-Type must be application/json')
        }

        let body: CreateUserBody;
        try {
            body = await req.json() as CreateUserBody
        } catch (e) {
            throw new Error('Invalid JSON body')
        }

        const { email, password, fullName, fullNameAr, role, committeeId, phone, level, joinDate, isAshbal } = body;

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

        // Create admin client with service role key (no user context needed for admin operations)
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

        const { data: requesterRoles, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', requester.id)

        if (roleError) {
            throw new Error(`Database error verifying role: ${roleError.message}`)
        }

        const roles = requesterRoles?.map(r => r.role) || []
        const isAuthorized = roles.includes('admin') || roles.includes('head_hr') || roles.includes('supervisor') || roles.includes('head_ashbal')

        if (!isAuthorized) {
            console.log(`User ${requester.id} attempted to create user but has roles: ${roles.join(', ')}`)
            throw new Error(`Unauthorized: Admin access required.`)
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

        // Insert/Update user role
        try {
            const { error: insertRoleError } = await supabaseAdmin
                .from('user_roles')
                .upsert({
                    user_id: userData.user.id,
                    role: role || 'volunteer'
                }, { onConflict: 'user_id' })

            if (insertRoleError) console.warn('Role upsert warning:', insertRoleError.message)
        } catch (roleErr) {
            console.error('Role upsert exception:', roleErr)
        }

        // Update profile
        try {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    full_name: fullName,
                    full_name_ar: fullNameAr,
                    committee_id: (committeeId === 'general' ? null : committeeId) || null,
                    phone: phone || null,
                    level: level || 'under_follow_up',
                    join_date: joinDate || undefined,
                    is_ashbal: isAshbal || false
                })
                .eq('id', userData.user.id)

            if (profileError) console.warn('Profile update warning:', profileError.message)
        } catch (profileErr) {
            console.error('Profile update exception:', profileErr)
        }

        // Store visible password
        if (password) {
            try {
                const { error: privateDetailsError } = await supabaseAdmin
                    .from('user_private_details')
                    .upsert({
                        id: userData.user.id,
                        visible_password: password
                    }, { onConflict: 'id', ignoreDuplicates: false })

                if (privateDetailsError) console.warn('Private details insert warning:', privateDetailsError.message)
            } catch (detailsErr) {
                console.error('Private details insert exception:', detailsErr)
            }
        }

        return new Response(
            JSON.stringify({ success: true, user: userData.user }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
            const errObj = error as any;
            errorMessage = errObj.message || errObj.error_description || errObj.error || JSON.stringify(error);
        } else if (typeof error === 'string') {
            errorMessage = error;
        }

        console.error('Error in create-user:', errorMessage)

        return new Response(
            JSON.stringify({ error: errorMessage, success: false }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    }
})
