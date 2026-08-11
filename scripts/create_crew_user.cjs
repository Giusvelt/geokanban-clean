const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    // Login as admin
    await s.auth.signInWithPassword({ email: 'giuseppe.berrelli@gmail.com', password: 'admin123' });

    // Find ANNAMARIA Z
    const { data: vessels } = await s.from('vessels').select('id, name, mmsi');
    const annamaria = vessels.find(v => v.name.toUpperCase().includes('ANNAMARIA'));
    console.log(`Found: ${annamaria.name} (MMSI: ${annamaria.mmsi}, ID: ${annamaria.id})`);

    await s.auth.signOut();

    // Use a gmail alias format (crew+annamariaz@gmail.com)
    const crewEmail = 'giuseppe.berrelli+crew.annamariaz@gmail.com';
    const crewPassword = 'crew2026!';

    const { data: signupData, error: signupErr } = await s.auth.signUp({
        email: crewEmail,
        password: crewPassword,
        options: {
            data: { name: 'Crew ANNAMARIA Z', role: 'crew' },
            emailRedirectTo: 'http://localhost:5173'
        }
    });

    if (signupErr) {
        console.log('Signup error:', signupErr.message);
        return;
    }

    const userId = signupData.user?.id;
    console.log('User created:', userId);
    console.log('Email confirmed?', signupData.user?.email_confirmed_at ? 'YES' : 'NO (needs confirmation)');

    // Try to login
    const { data: loginData, error: loginErr } = await s.auth.signInWithPassword({
        email: crewEmail, password: crewPassword
    });

    if (loginErr) {
        console.log('Cannot login yet:', loginErr.message);
        console.log('(Email confirmation may be required)');

        // Still create profile using admin
        await s.auth.signInWithPassword({ email: 'giuseppe.berrelli@gmail.com', password: 'admin123' });

        if (userId) {
            const { error: profileErr } = await s.from('user_profiles').insert({
                id: userId,
                email: crewEmail,
                display_name: 'Crew ANNAMARIA Z',
                role: 'crew',
                vessel_id: annamaria.id,
                is_active: true
            });
            if (profileErr) console.log('Profile insert error:', profileErr.message);
            else console.log('✅ Profile created via admin');
        }
    } else {
        console.log('Logged in as crew!');
        const { error: profileErr } = await s.from('user_profiles').insert({
            id: loginData.user.id,
            email: crewEmail,
            display_name: 'Crew ANNAMARIA Z',
            role: 'crew',
            vessel_id: annamaria.id,
            is_active: true
        });
        if (profileErr) console.log('Profile error:', profileErr.message);
        else console.log('✅ Profile created');
    }

    await s.auth.signOut();

    // Verify
    await s.auth.signInWithPassword({ email: 'giuseppe.berrelli@gmail.com', password: 'admin123' });
    const { data: profiles } = await s.from('user_profiles').select('email, display_name, role, vessel_id, vessels(name, mmsi)');
    console.log('\n=== ALL PROFILES ===');
    profiles?.forEach(p => {
        console.log(`  ${p.email} | ${p.role} | ${p.vessels ? p.vessels.name + ' (MMSI: ' + p.vessels.mmsi + ')' : 'ALL VESSELS'}`);
    });
    await s.auth.signOut();

    console.log('\n═══════════════════════════════════════');
    console.log('CREW LOGIN CREDENTIALS:');
    console.log(`  Email:    ${crewEmail}`);
    console.log(`  Password: ${crewPassword}`);
    console.log(`  Vessel:   ${annamaria.name} (MMSI: ${annamaria.mmsi})`);
    console.log('═══════════════════════════════════════');
}

main().catch(console.error);
