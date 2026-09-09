import React, { useState, useEffect } from 'react';
import { Anchor, ArrowUp } from 'lucide-react';
import { validateMooring } from '../../utils/mooringSafety';

const BERTH_HEADINGS = { T1: 18, T2: 44, T3: 44, T7: 21 };

const STATUS_COLORS = {
    POSITIVO: {
        bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-400 shadow-emerald-500/50',
        text: 'Safe / Positivo',
        desc: 'Le condizioni meteo rientrano pienamente nei parametri di stabilita e sicurezza prescritti dalle normative RINA.'
    },
    NEGATIVO: {
        bg: 'from-amber-500 to-orange-600', light: 'bg-amber-400 shadow-amber-500/50',
        text: 'Attenzione / Limite Superato',
        desc: 'Uno o piu parametri (altezza onda o vento) hanno superato le soglie limite previste per questo assetto.'
    },
    ERRORE: {
        bg: 'from-rose-500 to-red-600', light: 'bg-rose-400 shadow-rose-500/50',
        text: 'Pericolo / Disormeggio Obbligatorio',
        desc: 'Lo scarto angolare del vento rispetto alla prua ricade nella zona critica di instabilita. La nave deve procedere al disormeggio immediato.'
    },
};
const DEFAULT_STATUS = { bg: 'from-slate-500 to-slate-600', light: 'bg-slate-400', text: 'Non Noto', desc: 'Dati incompleti o errati.' };

export default function MooringCalculator() {
    const [calcDwt, setCalcDwt] = useState('7300');
    const [calcBerth, setCalcBerth] = useState('T1');
    const [calcWindDir, setCalcWindDir] = useState(180);
    const [calcMooringHeading, setCalcMooringHeading] = useState(18);
    const [calcHs, setCalcHs] = useState(0.5);
    const [calcWindSpeed, setCalcWindSpeed] = useState(12);

    useEffect(() => {
        if (BERTH_HEADINGS[calcBerth] !== undefined) setCalcMooringHeading(BERTH_HEADINGS[calcBerth]);
    }, [calcBerth]);

    const validation = validateMooring({ dwt: calcDwt, berth: calcBerth, windDir: calcWindDir, mooringHeading: calcMooringHeading, hs: calcHs, windSpeed: calcWindSpeed });
    const sc = STATUS_COLORS[validation.status] || DEFAULT_STATUS;

    return (
        <div className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 sm:p-10 shadow-inner">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center text-white shadow-md">
                    <Anchor className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Calcolatore Manuale di Sicurezza Ormeggio</h3>
                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Verifica Prescrizioni RINA e Limiti di Disormeggio</p>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Classe Nave (DWT)</label>
                            <select value={calcDwt} onChange={(e) => setCalcDwt(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer">
                                <option value="40000">40.000 DWT (es. Sider Abidjan)</option>
                                <option value="7300">7.300 DWT (es. Rebecca, Orion, Buffalo, Rodi)</option>
                                <option value="5270">5.270 DWT (es. Fabio Duo Z, Maria Vittoria Z, Annamaria Z)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Ormeggio / Banchina</label>
                            <select value={calcBerth} onChange={(e) => setCalcBerth(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer">
                                <option value="T1">Scanno Diga T1 (18 N)</option>
                                <option value="T2">Scanno Diga T2 (44 N)</option>
                                <option value="T3">Scanno Diga T3 (44 N)</option>
                                <option value="T7">Scanno Diga T7 (21 N)</option>
                                <option value="CUSTOM">Altro / Personalizzato</option>
                            </select>
                        </div>
                    </div>
                    {calcBerth === 'CUSTOM' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Angolo Ormeggio G [deg]</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min="0" max="360" value={calcMooringHeading} onChange={(e) => setCalcMooringHeading(Number(e.target.value))} className="flex-1 accent-sky-500" />
                                <input type="number" min="0" max="360" value={calcMooringHeading} onChange={(e) => setCalcMooringHeading(Number(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 text-center" />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Direzione Vento Previsto F [deg]</label>
                        <div className="flex items-center gap-3">
                            <input type="range" min="0" max="360" value={calcWindDir} onChange={(e) => setCalcWindDir(Number(e.target.value))} className="flex-1 accent-sky-500" />
                            <input type="number" min="0" max="360" value={calcWindDir} onChange={(e) => setCalcWindDir(Number(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-700 text-center" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Altezza Onda Hs Prevista [m]</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min="0" max="3" step="0.1" value={calcHs} onChange={(e) => setCalcHs(Number(e.target.value))} className="flex-1 accent-sky-500" />
                                <span className="w-16 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-2xl py-1.5 text-center shadow-sm">{calcHs.toFixed(1)} m</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Velocita Vento Prevista [kn]</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min="0" max="40" value={calcWindSpeed} onChange={(e) => setCalcWindSpeed(Number(e.target.value))} className="flex-1 accent-sky-500" />
                                <span className="w-16 text-xs font-extrabold text-slate-700 bg-white border border-slate-200 rounded-2xl py-1.5 text-center shadow-sm">{calcWindSpeed} kn</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-5 flex flex-col justify-between">
                    <div className="h-full flex flex-col justify-between bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden min-h-[300px]">
                        <div className={`text-white p-5 rounded-3xl bg-gradient-to-tr ${sc.bg} flex items-center justify-between shadow-lg`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3.5 h-3.5 rounded-full ${sc.light} animate-pulse shadow-md`} />
                                <div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white/70 block leading-none mb-1">Esito RINA</span>
                                    <span className="text-sm font-extrabold tracking-tight">{sc.text}</span>
                                </div>
                            </div>
                            <span className="text-2xl font-black">{validation.delta.toFixed(0)}<span className="text-xs font-bold ml-1 text-white/80">Delta</span></span>
                        </div>
                        <div className="my-6 space-y-4">
                            <p className="text-xs font-semibold text-slate-500 leading-normal">{sc.desc}</p>
                            <div className="h-px bg-slate-100 w-full" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-2xl p-3">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Hs Massimo</span>
                                    <span className="text-xs font-extrabold text-slate-700">{validation.hsLimit === 'ERRORE' ? 'ERRORE' : `${validation.hsLimit?.toFixed(1)} m`}</span>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Vento Massimo</span>
                                    <span className="text-xs font-extrabold text-slate-700">{validation.windLimit} kn</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-4 bg-slate-50 rounded-2xl p-3 mt-auto">
                            <div className="relative w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center">
                                <ArrowUp size={16} className="text-amber-500 absolute transition-transform duration-300" style={{ transform: `rotate(${calcWindDir}deg)` }} />
                                <div className="w-1 h-3 bg-slate-400 rounded-full" style={{ transform: `rotate(${calcMooringHeading}deg)` }} />
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block leading-none mb-1">Orientamento</span>
                                <span className="text-[10px] font-bold text-slate-600">Prua: {calcMooringHeading} | Vento: {calcWindDir}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
