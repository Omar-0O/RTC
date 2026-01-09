import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read your .env file or use environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dscphfuyhjorrshtyqan.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
    console.error('Error: SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    try {
        console.log('Reading migration file...');
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260109000000_fix_group_submissions_rls.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Applying migration to fix group_submissions RLS policy...');
        console.log('SQL:', sql);

        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error applying migration:', error);
            console.log('\n⚠️  The RPC function may not exist. Applying SQL in parts...\n');

            // Split SQL into statements and execute each
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            for (const statement of statements) {
                console.log('Executing:', statement.substring(0, 100) + '...');
                const result = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
                if (result.error) {
                    console.error('Error:', result.error);
                }
            }
        } else {
            console.log('✅ Migration applied successfully!');
        }

        console.log('\n✅ Done! Try submitting a group participation now.');
    } catch (error) {
        console.error('Error:', error);
        console.log('\n❌ Could not apply migration automatically.');
        console.log('Please apply it manually via Supabase Dashboard SQL Editor.');
    }
}

applyMigration();
