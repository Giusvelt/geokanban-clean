const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
    await s.auth.signInWithPassword({ email: 'giuseppe.berrelli@gmail.com', password: 'admin123' });

    // Translate Activities to English
    const actUpdates = [
        { code: 'NAV', name: 'Navigation', description: 'Transit between geofences' },
        { code: 'DOCK', name: 'Mooring', description: 'Mooring operation upon arrival' },
        { code: 'UNDOCK', name: 'Unmooring', description: 'Unmooring operation before departure' },
        { code: 'LOAD', name: 'Loading', description: 'Material loading operation' },
        { code: 'UNLOAD', name: 'Unloading', description: 'Material unloading operation' },
        { code: 'REFUEL', name: 'Bunkering', description: 'Fuel supply operation' },
        { code: 'MAINT', name: 'Maintenance', description: 'Engine/hull maintenance' }
    ];

    console.log('=== TRANSLATING ACTIVITIES ===');
    for (const u of actUpdates) {
        const { error } = await s.from('activities').update({ name: u.name, description: u.description }).eq('code', u.code);
        console.log(`  ${u.code}: ${error ? 'ERR ' + error.message : 'OK → ' + u.name}`);
    }

    // Translate Services to English
    const svcUpdates = [
        { code: 'TUG', name: 'Tugboat' },
        { code: 'PIL', name: 'Pilot' },
        { code: 'MOOR', name: 'Mooring Crew' }
    ];

    console.log('=== TRANSLATING SERVICES ===');
    for (const u of svcUpdates) {
        const { error } = await s.from('services').update({ name: u.name }).eq('code', u.code);
        console.log(`  ${u.code}: ${error ? 'ERR ' + error.message : 'OK → ' + u.name}`);
    }

    // Verify
    console.log('\n=== VERIFICATION ===');
    const { data: acts } = await s.from('activities').select('code, name').order('code');
    acts.forEach(a => console.log(`  ${a.code}: ${a.name}`));
    const { data: svcs } = await s.from('services').select('code, name').order('code');
    svcs.forEach(sv => console.log(`  ${sv.code}: ${sv.name}`));

    await s.auth.signOut();
    process.exit(0);
})();
