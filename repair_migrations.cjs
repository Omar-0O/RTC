const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

console.log(`Found ${files.length} migration files.`);

// Sort files to be sure
files.sort();

const cutoff = '20260214000000';

const toRepair = files.filter(f => {
    const version = f.split('_')[0];
    return version < cutoff;
});

console.log(`Found ${toRepair.length} migrations to repair (mark as applied).`);

// Execute repair
// We can batch this or do one by one.
// supabase migration repair takes one version or multiple?
// Arguments: <version>...
// It takes multiple versions.

if (toRepair.length === 0) {
    console.log('No migrations to repair.');
    process.exit(0);
}

const versions = toRepair.map(f => f.split('_')[0]);

// To avoid command line length limits, let's process in chunks of 20
const chunkSize = 20;
for (let i = 0; i < versions.length; i += chunkSize) {
    const chunk = versions.slice(i, i + chunkSize);
    const command = `npx supabase migration repair --status applied ${chunk.join(' ')}`;
    console.log(`Processing chunk ${i / chunkSize + 1}/${Math.ceil(versions.length / chunkSize)}...`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (e) {
        console.error('Error repairing migrations:', e);
        process.exit(1);
    }
}

console.log('Successfully repaired migration history.');
