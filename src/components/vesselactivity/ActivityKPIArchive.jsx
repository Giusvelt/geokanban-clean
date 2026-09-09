import React, { useMemo } from 'react';
import { Target, TrendingUp, Package, BarChart2 } from 'lucide-react';
import { getVesselActivities, countActivitiesByType } from '../../utils/activityUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export default function ActivityKPIArchive({ productionPlans, selectedMonth, selectedYear, aisStats, vessels, activities }) {
    const kpiByMonth = useMemo(() => {
        const groups = {};
        
        // Group data exclusively from productionPlans (Source of Truth)
        (productionPlans || []).forEach(p => {
            if (!p.period_name) return;
            
            const [mName, yStr] = p.period_name.split(' ');
            const mIdx = MONTHS.indexOf(mName);
            if (mIdx === -1) return;
            
            const year = Number(yStr);
            const key = `${year}-${mIdx}`;
            
            if (!groups[key]) {
                groups[key] = { month: mIdx, year, loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0 };
            }

            if (p.vessel_id === null) {
                // Global goal
                groups[key].goalTons = p.target_quantity || 0;
            } else {
                // Aggregate vessel actuals
                groups[key].unloading += (p.actual_trips || 0);
                groups[key].deliveredTons += (p.actual_quantity || 0);
                groups[key].loading += (p.loading_count || 0);
                groups[key].navigation += (p.navigation_count || 0);
            }
        });
        
        return Object.values(groups).sort((a,b) => b.year - a.year || b.month - a.month);
    }, [productionPlans]);

    const stats = useMemo(() => {
        const current = kpiByMonth.find(k => k.month === selectedMonth && k.year === selectedYear) || {
            loading: 0, navigation: 0, unloading: 0, deliveredTons: 0, goalTons: 0
        };
        // Calcolo reale dinamico: SOMMA (vessel.avg_cargo * loading_count) per ogni nave
        let calculatedDelivered = 0;
        (vessels || []).forEach(v => {
            const vActs = getVesselActivities(activities, v);
            const loadingCount = countActivitiesByType(vActs, 'Loading');
            const cargo = v.avg_cargo || 0;
            calculatedDelivered += (cargo * loadingCount);
        });

        const totalTarget = current.goalTons || 300000;
        const deliveredTotal = calculatedDelivered > 0 ? calculatedDelivered : (current.deliveredTons || 0);
        const remainingTotal = Math.max(0, totalTarget - deliveredTotal);
        const progressPct = totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0;

        return {
            loading: current.loading,
            navigation: current.navigation,
            unloading: current.unloading,
            totalAis: aisStats.total,
            submittedAis: aisStats.submitted,
            deliveredTons: deliveredTotal,
            goalTons: totalTarget,
            remainingTons: remainingTotal,
            progress: progressPct
        };
    }, [kpiByMonth, selectedMonth, selectedYear, aisStats, vessels, activities]);

    return (
        <>
                    <div className="production-stats-grid">
                        {[
                            { label: 'Monthly Goal', value: stats.goalTons.toLocaleString(), unit: 'tons', icon: Target, color: 'text-primary', bg: 'bg-primary/10', border: 'border-b-primary shadow-sm' },
                            { label: 'Delivered (Est.)', value: stats.deliveredTons.toLocaleString(), unit: 't', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Remaining', value: stats.remainingTons.toLocaleString(), unit: 't', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Overall Progress', progress: stats.progress, icon: BarChart2, color: 'text-primary', bg: 'bg-primary/5' },
                        ].map((stat, i) => (
                            <div key={i} className={`bg-white rounded-2xl p-5 border border-surface-low ${stat.border || ''} flex items-center gap-4`}>
                                {stat.progress !== undefined ? (
                                    <>
                                        <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                                            <div className="text-sm font-black text-primary">{stat.progress}%</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-2">{stat.label}</p>
                                            <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${stat.progress}%` }} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div className="flex-1">
                                             <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mb-1">{stat.label}</p>
                                             <div className="flex items-end gap-1">
                                                 <h3 className={`text-2xl font-manrope font-extrabold ${stat.color} leading-none`}>{stat.value}</h3>
                                                 <span className={`text-xs font-bold ${stat.color}/60 mb-0.5`}>{stat.unit}</span>
                                             </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* COMPACT OPERATIONAL STATS ROW â€” PHASE 28 */}
                    <div className="stats-row-compact">
                        {[
                            { label: 'Loading', value: stats.loading, color: 'text-green-500' },
                            { label: 'Navigation', value: stats.navigation, color: 'text-blue-500' },
                            { label: 'Unloading', value: stats.unloading, color: 'text-amber-500' },
                            { label: 'Tracked Vessels', value: (vessels || []).filter(v => v.tracking_active).length, color: 'text-purple-500' },
                        ].map((stat, i) => (
                            <div key={i} className="stat-card-compact group">
                                <span className="stat-label">{stat.label}</span>
                                <span className={`stat-value ${stat.color}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>



        </>
    );
}
