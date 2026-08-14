import React, { useState } from 'react';
import { useFleet, useOperations } from '../context/DataContext';
import { Target, TrendingUp, Package, Edit2, Check, X, Ship, Trash2, BarChart2, RefreshCw, CalendarDays } from 'lucide-react';
import SectionHeader from './SectionHeader';
import complianceData from '../data/compliance_kpi_data.json';

export default function ProductionTargetTab() {
    const { vessels, updateVessel, deleteVessel } = useFleet();
    const { productionPlans, upsertPlan, activities, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useOperations();

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const currentPeriod = `${MONTHS[selectedMonth]} ${selectedYear}`;

    const [summaryEdit, setSummaryEdit] = useState(null); 
    const [vesselEdits, setVesselEdits] = useState({});
    const [showKpiArchive, setShowKpiArchive] = useState(false);
    const [showComplianceArchive, setShowComplianceArchive] = useState(false);

    // Calcolo KPI dinamici reali derivanti dalla tabella Compliance (Programmati vs Consuntivati)
    const validDays = complianceData || [];
    const totalPlannedTasks = validDays.reduce((sum, d) => sum + (d['Task Programmati (N)'] || 0), 0);
    const totalActualTasks = validDays.reduce((sum, d) => sum + (d['Task Consuntivati (N)'] || 0), 0);
    const totalDeficitTasks = validDays.reduce((sum, d) => sum + (d['Deficit Task (TDI)'] || 0), 0);
    const avgComplianceTER = validDays.length > 0 ? (totalActualTasks / totalPlannedTasks * 100).toFixed(1) : '0.0';

    // Calcolo dinamico reale tonnellaggio: SOMMA (vessel.avg_cargo * loading_count per ogni nave)
    const calculatedDelivered = (vessels || []).reduce((sum, v) => {
        const vActivities = (activities || []).filter(a => a.vesselId === v.id || a.vessel === v.name);
        const loadingCount = vActivities.filter(a => a.activity === 'Loading').length;
        const cargo = v.avg_cargo || 0;
        return sum + (cargo * loadingCount);
    }, 0);

    const deliveredTotal = calculatedDelivered > 0 ? calculatedDelivered : 0;

    const globalPlan = (productionPlans || []).find(p => p.vessel_id === null && p.period_name === currentPeriod);
    const totalTarget = summaryEdit !== null ? summaryEdit : (globalPlan?.target_quantity || 300000);
    const remainingTotal = Math.max(0, totalTarget - deliveredTotal);

    const handleSaveSummary = async () => {
        if (summaryEdit === null) return;
        try {
            const planPayload = {
                vessel_id: null,
                period_name: currentPeriod,
                target_quantity: summaryEdit,
                target_trips: 0
            };

            await upsertPlan(planPayload);
            setSummaryEdit(null);
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };

    const handleDeleteVessel = async (vesselId, vesselName) => {
        const confirmDelete = window.confirm(`ATTENZIONE OPERAZIONE DISTRUTTIVA!\nStai per eliminare per sempre la nave "${vesselName}". Tutte le card ed eventi legati potrebbero essere cancellati. Sei sicuro di voler procedere?`);
        if (!confirmDelete) return;

        try {
            const result = await deleteVessel(vesselId);
            if (!result.success) throw new Error(result.error || 'Errore database');
        } catch (error) {
            alert('Impossibile eliminare la nave. Errore: ' + error.message);
        }
    };

    const handleSaveVessel = async (vesselId) => {
        const edit = vesselEdits[vesselId];
        if (!edit) return;

        try {
            const plan = (productionPlans || []).find(p => p.vessel_id === vesselId && p.period_name === currentPeriod);

            const targetQty = edit.targetQty !== undefined ? Number(edit.targetQty) : (plan?.target_quantity || 0);
            const grossTonnage = edit.grossTonnage !== undefined ? Number(edit.grossTonnage) : null;
            
            const planPayload = {
                vessel_id: vesselId,
                period_name: currentPeriod,
                target_quantity: targetQty,
                target_trips: plan?.target_trips || 0
            };
            
            await upsertPlan(planPayload);

            if (grossTonnage !== null) {
                const res = await updateVessel(vesselId, { gross_tonnage: grossTonnage });
                if (!res.success) throw new Error(res.error);
            }

            setVesselEdits(prev => {
                const next = { ...prev };
                delete next[vesselId];
                return next;
            });
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };

    return (
        <div className="pt-tab-container p-4 lg:p-6 pb-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <SectionHeader 
                    title="Production Targets" 
                    subtitle="Monthly delivery quotas and efficiency tracking" 
                    icon={Target}
                />
                
                {/* Period Selector — Sincronizzato con il KI Stabilization v3.15 */}
                <div className="flex items-center bg-white border border-surface-low/30 rounded-xl overflow-hidden shadow-sm self-start lg:self-center">
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(parseInt(e.target.value))} 
                        className="bg-transparent pl-4 pr-2 py-2 text-[10px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors"
                    >
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <div className="w-px h-4 bg-surface-low/30" />
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value))} 
                        className="bg-transparent px-3 py-2 text-[10px] font-black uppercase text-on-surface outline-none cursor-pointer hover:bg-surface-low/10 transition-colors"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="tab-content production-targets-tab">
                {/* 1. Global Metrics & Compliance KPI (Top Row - 6 Cards Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                    {/* 1. Monthly Goal (Tonnellaggio Target) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low border-b-4 border-b-primary shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Target size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest truncate">Target Ton</p>
                                <button className="text-on-surface/30 hover:text-primary transition-colors" onClick={() => summaryEdit !== null ? handleSaveSummary() : setSummaryEdit(totalTarget)}>
                                    {summaryEdit !== null ? <Check size={12} /> : <Edit2 size={10} />}
                                </button>
                            </div>
                            <div className="flex items-end gap-1">
                                {summaryEdit !== null ? (
                                    <input type="number" autoFocus value={summaryEdit} onChange={e => setSummaryEdit(Number(e.target.value))} className="w-full bg-surface-low/30 border-none rounded px-1.5 py-0.5 text-lg font-extrabold outline-none" />
                                ) : (
                                    <>
                                        <h3 className="text-xl font-manrope font-extrabold text-on-surface leading-none truncate">{totalTarget.toLocaleString()}</h3>
                                        <span className="text-[10px] font-bold text-on-surface/40 mb-0.5">t</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Delivered (Tonnellaggio Reale DB) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                            <TrendingUp size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5 truncate">Consegnato</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-xl font-manrope font-extrabold text-green-600 leading-none truncate">{deliveredTotal.toLocaleString()}</h3>
                                <span className="text-[10px] font-bold text-green-600/60 mb-0.5">t</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Task Programmati (Da Consuntivi/Programmi) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                            <CalendarDays size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5 truncate">Task Programmati</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-xl font-manrope font-extrabold text-blue-600 leading-none">{totalPlannedTasks}</h3>
                                <span className="text-[10px] font-bold text-blue-600/60 mb-0.5">task</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Task Consuntivati (Effettivi) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                            <Check size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5 truncate">Task Eseguiti</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-xl font-manrope font-extrabold text-emerald-600 leading-none">{totalActualTasks}</h3>
                                <span className="text-[10px] font-bold text-emerald-600/60 mb-0.5">task</span>
                            </div>
                        </div>
                    </div>

                    {/* 5. Task Deficit (TDI) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                            <X size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5 truncate">Deficit Task (TDI)</p>
                            <div className="flex items-end gap-1">
                                <h3 className="text-xl font-manrope font-extrabold text-red-600 leading-none">{totalDeficitTasks}</h3>
                                <span className="text-[10px] font-bold text-red-600/60 mb-0.5">mancanti</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. TER % (Aderenza Programmazione) */}
                    <div className="bg-white rounded-2xl p-4 border border-surface-low shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-black text-indigo-600">{avgComplianceTER}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-1 truncate">Aderenza (TER)</p>
                            <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, parseFloat(avgComplianceTER))}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 📊 KPI / M — MONTHLY PERFORMANCE ARCHIVE (A SCOMPARSA) */}
                <div className="kpi-archive-section mb-6">
                    <div className="kpi-archive-header" onClick={() => setShowKpiArchive(!showKpiArchive)}>
                        <BarChart2 size={18} />
                        <span>KPI / M — Monthly Performance Archive</span>
                        <div className="kpi-archive-toggle">
                            <RefreshCw size={14} className={showKpiArchive ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                        </div>
                    </div>

                    {showKpiArchive && (
                        <div className="kpi-archive-table-wrap">
                            <table className="kpi-archive-table">
                                <thead>
                                    <tr>
                                        <th>Period</th>
                                        <th>Loading</th>
                                        <th>Navigation</th>
                                        <th>Unloading</th>
                                        <th>Goal</th>
                                        <th>Ops</th>
                                        <th className="text-right">Achievement</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { period: 'July 2026', loading: 65, navigation: 248, unloading: 59, goal: '300k t', ops: 372, pct: totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0, delivered: `${Math.round(deliveredTotal/1000)}k`, active: true },
                                        { period: 'June 2026', loading: 7, navigation: 132, unloading: 3, goal: '—', ops: 142, pct: 0, delivered: '11k', active: false }
                                    ].map((k, i) => (
                                        <tr key={i} className={k.active ? 'kpi-row-active' : ''}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays size={14} className="opacity-20" />
                                                    <span>{k.period}</span>
                                                    {k.active && <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ml-2">Active</span>}
                                                </div>
                                            </td>
                                            <td><span className="kpi-badge loading">{k.loading}</span></td>
                                            <td><span className="kpi-badge navigation">{k.navigation}</span></td>
                                            <td><span className="kpi-badge unloading">{k.unloading}</span></td>
                                            <td className="italic text-on-surface/30">{k.goal}</td>
                                            <td>{k.ops}</td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="font-black text-sm">{k.pct}%</span>
                                                        <span className="text-[9px] opacity-40">{k.delivered} / {k.goal}</span>
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-surface-low rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, k.pct)}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 📊 KPI / M — WORK PROGRAM COMPLIANCE ARCHIVE (PLANNED VS ACTUAL - A SCOMPARSA) */}
                <div className="kpi-archive-section mb-8">
                    <div className="kpi-archive-header" onClick={() => setShowComplianceArchive(!showComplianceArchive)}>
                        <BarChart2 size={18} />
                        <span>KPI / M — Work Program Compliance Archive (Planned vs. Actual)</span>
                        <div className="kpi-archive-toggle">
                            <RefreshCw size={14} className={showComplianceArchive ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                        </div>
                    </div>

                    {showComplianceArchive && (
                        <div className="kpi-archive-table-wrap">
                            <table className="kpi-archive-table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Stato Cantiere</th>
                                        <th>Planned Tasks</th>
                                        <th>Actual Tasks</th>
                                        <th>Deficit (TDI)</th>
                                        <th className="text-right">Aderenza (TER %)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(complianceData || []).map((row, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays size={14} className="opacity-20" />
                                                    <span className="font-bold">{row.Data}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`kpi-badge ${row['Stato Cantiere'] === 'FERMO METEO' ? 'unloading' : 'loading'}`}>
                                                    {row['Stato Cantiere']}
                                                </span>
                                            </td>
                                            <td>{row['Task Programmati (N)']}</td>
                                            <td>{row['Task Consuntivati (N)']}</td>
                                            <td>
                                                <span className="font-bold text-amber-600">{row['Deficit Task (TDI)']}</span>
                                            </td>
                                            <td className="text-right font-black">
                                                <span className={
                                                    row['Aderenza Programma (TER %)'] >= 90 ? 'text-green-600' :
                                                    row['Aderenza Programma (TER %)'] >= 50 ? 'text-amber-600' : 'text-red-600'
                                                }>
                                                    {row['Aderenza Programma (TER %)']}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 📊 TABELLA ANAGRAFICA E PRODUZIONE NAVALE DB (TRASFORMAZIONE COMPLETATA) */}
                <div className="bg-white rounded-2xl p-6 border border-surface-low shadow-sm mb-8">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-low">
                        <div>
                            <h3 className="text-base font-manrope font-extrabold text-on-surface">Anagrafica & Produzione Navale Calcolata da DB</h3>
                            <p className="text-xs text-on-surface/50 font-medium">Produzione calcolata sui dati reali del DB: Carico Medio (Avg Cargo) × Conteggio Attività di Loading nei Geofence</p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-3 py-1 rounded-full">
                            Fonte Dati: Live Database
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-surface-low text-[10px] font-black text-on-surface/40 uppercase tracking-widest bg-surface-lowest">
                                    <th className="py-3 px-4">Nave</th>
                                    <th className="py-3 px-4">MMSI</th>
                                    <th className="py-3 px-4">Tipo</th>
                                    <th className="py-3 px-4 text-center">Carico Medio (Avg Cargo)</th>
                                    <th className="py-3 px-4 text-center">Loading Count (Geofence)</th>
                                    <th className="py-3 px-4 text-center">Unloading Count</th>
                                    <th className="py-3 px-4 text-right">Produzione Calcolata (t)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-low/50">
                                {(vessels || []).map((v, i) => {
                                    const vActivities = (activities || []).filter(a => a.vesselId === v.id || a.vessel === v.name);
                                    const loadingCount = vActivities.filter(a => a.activity === 'Loading').length;
                                    const unloadingCount = vActivities.filter(a => a.activity === 'Unloading').length;
                                    const cargo = v.avg_cargo || 0;
                                    const calculatedProduction = cargo * loadingCount;

                                    return (
                                        <tr key={i} className="hover:bg-surface-lowest transition-colors">
                                            <td className="py-3 px-4 font-extrabold text-on-surface flex items-center gap-2">
                                                <Ship size={16} className="text-primary opacity-60" />
                                                <span>{v.name}</span>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-on-surface/60">{v.mmsi || '—'}</td>
                                            <td className="py-3 px-4 font-medium text-on-surface/70">{v.type || 'Barge / Carrier'}</td>
                                            <td className="py-3 px-4 text-center font-bold">{cargo > 0 ? `${cargo.toLocaleString()} t` : '—'}</td>
                                            <td className="py-3 px-4 text-center font-black text-green-600 bg-green-50/50 rounded-lg">{loadingCount}</td>
                                            <td className="py-3 px-4 text-center font-bold text-amber-600">{unloadingCount}</td>
                                            <td className="py-3 px-4 text-right font-black text-primary text-sm">
                                                {calculatedProduction > 0 ? `${calculatedProduction.toLocaleString()} t` : '0 t'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>


            </div>
        </div>
    );
}
