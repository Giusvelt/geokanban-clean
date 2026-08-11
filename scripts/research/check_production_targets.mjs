import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
    if (line.includes('=')) {
        const parts = line.split('=');
        const k = parts[0].trim();
        const v = parts.slice(1).join('=').trim();
        env[k] = v;
    }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
    await supabase.auth.signInWithPassword({ email: 'veromidollo@gmail.com', password: 'crew123' });

    const currentPeriod = 'March 2026'; // Based on the screenshot context

    // 1. Fetch Vessels
    const { data: vessels } = await supabase.from('vessels').select('*');

    // 2. Fetch Production Plans for current period
    const { data: plans } = await supabase
        .from('production_plans')
        .select('*')
        .eq('period_name', currentPeriod);

    console.log(`--- PRODUCTION DATA FOR ${currentPeriod} ---`);
    console.log(`Plans found: ${plans?.length || 0}`);

    // Calculation logic mirroring ProductionTargetTab.jsx

    // Delivered calculation
    let deliveredTotal = 0;
    const vesselDetails = [];

    plans.filter(p => p.vessel_id !== null).forEach(p => {
        const v = vessels.find(v => v.id === p.vessel_id);
        const cargo = v?.avg_cargo || 0;
        const trips = p.actual_trips || 0;
        const delivered = trips * cargo;
        deliveredTotal += delivered;

        vesselDetails.push({
            vessel: v?.name || 'Unknown',
            actual_trips: trips,
            avg_cargo: cargo,
            delivered_tons: delivered
        });
    });

    const globalPlan = plans.find(p => p.vessel_id === null);

    const sumTargets = plans
        .filter(p => p.vessel_id !== null)
        .reduce((s, p) => s + (p.target_quantity || 0), 0);

    const totalTarget = globalPlan?.target_quantity || sumTargets;
    const remainingTotal = Math.max(0, totalTarget - deliveredTotal);
    const progress = totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0;

    console.log(`\n--- Vesssel Breakdown ---`);
    console.table(vesselDetails);

    console.log(`\n--- DASHBOARD COUNTERS ---`);
    console.log(`MONTHLY GOAL: ${totalTarget.toLocaleString('it-IT')} tons`);
    console.log(`DELIVERED:    ${deliveredTotal.toLocaleString('it-IT')} t`);
    console.log(`REMAINING:    ${remainingTotal.toLocaleString('it-IT')} t`);
    console.log(`PROGRESS:     ${progress}%`);
}

runTest();
