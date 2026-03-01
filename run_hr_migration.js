const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260301142817_allow_hr_group_submissions_2.sql');

async function run() {
    console.log(`\n\x1b[33m\x1b[1m============== IMPORTANT ==============\x1b[0m\n`);
    console.log('To enable HR to log group submissions, you MUST run the SQL commands in your Supabase Database.');
    console.log('Since `npx supabase db push` is hanging in your terminal, please do this manually:');
    console.log(`\n1. Open your Supabase Dashboard SQL Editor.`);
    console.log(`2. Copy all text from: \x1b[36m${sqlPath}\x1b[0m`);
    console.log('3. Paste it into the editor and click "RUN".');
    console.log(`\n\x1b[33m\x1b[1m=======================================\x1b[0m\n`);

    // Attempt to run via exec_sql if available
    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (!error) {
            console.log('✅ Successfully applied migration automatically via exec_sql RPC!');
        } else {
            console.log('⚠️ Could not run automatically (RPC exec_sql not found). Please follow the manual steps above.');
        }
    } catch (e) {
        console.log('⚠️ Could not run automatically. Please follow the manual steps above.');
    }
}

run();
