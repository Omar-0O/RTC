const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const supabaseMock = {
    from: () => ({
        select: async () => { await sleep(50); return { data: [{id: 1}] }; },
        delete: () => ({
            eq: async () => { await sleep(50); return { error: null }; },
            in: async () => { await sleep(50); return { error: null }; }
        }),
        insert: async () => { await sleep(50); return { error: null }; },
    })
};

async function testSequential() {
    const start = performance.now();

    // Manage Participants
    const existingParts = [{id: 1}];
    const toRemove = [{id: 1}];
    const toAdd = [{id: 2}];

    if (toRemove.length > 0) {
        await supabaseMock.from('event_participants').delete().in('id', toRemove.map(p => p.id));
    }
    if (toAdd.length > 0) {
        await supabaseMock.from('event_participants').insert([]);
    }

    // Sync speakers
    await supabaseMock.from('event_speakers').delete().eq('event_id', 1);
    await supabaseMock.from('event_speakers').insert([]);

    // Sync organizers
    await supabaseMock.from('event_organizers').delete().eq('event_id', 1);
    await supabaseMock.from('event_organizers').insert([]);

    return performance.now() - start;
}

async function testParallel() {
    const start = performance.now();

    const existingParts = [{id: 1}];
    const toRemove = [{id: 1}];
    const toAdd = [{id: 2}];

    const tasks = [];

    if (toRemove.length > 0) {
        tasks.push(supabaseMock.from('event_participants').delete().in('id', toRemove.map(p => p.id)));
    }
    if (toAdd.length > 0) {
        tasks.push(supabaseMock.from('event_participants').insert([]));
    }

    tasks.push((async () => {
        await supabaseMock.from('event_speakers').delete().eq('event_id', 1);
        await supabaseMock.from('event_speakers').insert([]);
    })());

    tasks.push((async () => {
        await supabaseMock.from('event_organizers').delete().eq('event_id', 1);
        await supabaseMock.from('event_organizers').insert([]);
    })());

    await Promise.all(tasks);

    return performance.now() - start;
}

async function run() {
    const seq = await testSequential();
    const par = await testParallel();
    console.log(`Sequential: ${seq}ms`);
    console.log(`Parallel: ${par}ms`);
}

run();
