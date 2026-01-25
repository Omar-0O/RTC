import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dscphfuyhjorrshtyqan.supabase.co'
const supabaseKey = 'sb_publishable_MavplehN3DhPfJsKowa5jQ_fsT400kj'
const supabase = createClient(supabaseUrl, supabaseKey)

async function listActivityTypes() {
    const { data, error } = await supabase
        .from('activity_types')
        .select('id, name, name_ar, mode')

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Activity Types:', data)
    }
}

listActivityTypes()
