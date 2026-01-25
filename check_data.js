import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dscphfuyhjorrshtyqan.supabase.co'
const supabaseKey = 'sb_publishable_MavplehN3DhPfJsKowa5jQ_fsT400kj'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSubmissions() {
    const { data, error } = await supabase
        .from('activity_submissions')
        .select('participant_type, count', { count: 'exact', head: false })

    // Since we can't do GROUP BY easily with JS client without RPC, let's just fetch all participant_types
    // Actually, let's just fetch a few to see if any exist.

    const { data: types, error: typesError } = await supabase
        .from('activity_submissions')
        .select('participant_type')

    if (typesError) {
        console.log("Error fetching types:", typesError);
        return;
    }

    const counts = {};
    types.forEach(row => {
        const type = row.participant_type || 'volunteer (default)'; // Old rows might be null
        counts[type] = (counts[type] || 0) + 1;
    });

    console.log('Submission Counts by Type:', counts);

    // Also check if we have any recently created ones
    const { data: recent, error: recentError } = await supabase
        .from('activity_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('Recent Submissions:', recent);

}

checkSubmissions()
