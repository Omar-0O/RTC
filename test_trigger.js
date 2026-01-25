import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dscphfuyhjorrshtyqan.supabase.co'
const supabaseKey = 'sb_publishable_MavplehN3DhPfJsKowa5jQ_fsT400kj'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testTrigger() {
    console.log('--- Starting Trigger Test ---');

    // 1. Create a Test Caravan
    const { data: caravan, error: caravanError } = await supabase
        .from('caravans')
        .insert({
            name: 'Test Trigger Caravan ' + Date.now(),
            type: 'charity_market',
            location: 'Test Loc',
            date: new Date().toISOString().split('T')[0], // Today
            move_time: '10:00',
            created_by: 'e527f310-9b69-4628-9125-983177894372' // Admin ID from previous context or just any UUID if unknown, but usually need valid user. 
            // Actually, I don't have a valid user ID easily without login.
            // But RLS might block if I don't auth. 
            // The anon key has public access? Usually yes for dev.
        })
        .select()
        .single();

    if (caravanError) {
        console.error('Error creating caravan:', caravanError);
        // Try fetching an existing one if create fails (e.g. RLS)
        return;
    }
    console.log('Created Caravan:', caravan.id);

    // 2. Add Guest Participant
    const guestName = 'Test Guest ' + Date.now();
    const { data: participant, error: partError } = await supabase
        .from('caravan_participants')
        .insert({
            caravan_id: caravan.id,
            name: guestName,
            is_volunteer: false,
            wore_vest: false
        })
        .select()
        .single();

    if (partError) {
        console.error('Error adding participant:', partError);
        return;
    }
    console.log('Added Participant:', participant);

    // 3. Wait a bit for Trigger
    await new Promise(r => setTimeout(r, 2000));

    // 4. Check Activity Submissions
    const { data: submissions, error: subError } = await supabase
        .from('activity_submissions')
        .select('*')
        .eq('guest_name', guestName);

    if (subError) {
        console.error('Error checking submissions:', subError);
    } else {
        console.log('Found Submissions:', submissions.length);
        console.log(submissions);
    }
}

testTrigger();
