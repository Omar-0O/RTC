import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dscphfuyhjorrshtyqan.supabase.co'
const supabaseKey = 'sb_publishable_MavplehN3DhPfJsKowa5jQ_fsT400kj'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const email = 'antigravity_test1@gmail.com'
    const password = 'password123'

    console.log('Attempting to create user:', email)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Antigravity Test',
            }
        }
    })

    if (error) {
        console.error('Error creating user:', error)
    } else {
        console.log('User creation result:', data.user ? 'Success' : 'No user returned')
        if (data.session) console.log('Session created immediately.')
        else console.log('No session created immediately (check confirmation).')
    }

    // Try to sign in just in case
    console.log('Attempting sign in...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (signInError) {
        console.error('Sign in error:', signInError)
    } else {
        console.log('Sign in success! access_token:', !!signInData.session)
    }

}

run()
