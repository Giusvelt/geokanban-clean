import React from 'react';
import { 
    Wind, MessageSquare, ChevronRight, 
    ShoppingBag, Star, Zap, Info, Bell, Droplet, Coffee, Shield
} from 'lucide-react';

export default function MobileCrewNews() {
    const products = [
        { 
            name: 'Acqua Minerale 6x1.5L', 
            category: 'Supplies', 
            price: '€4.50', 
            icon: Droplet,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            desc: 'Consegna diretta in banchina.',
            url: 'https://www.esselungaacasa.it/ecommerce/nav/d/consegna-a-domicilio/beverages/water.html'
        },
        { 
            name: 'Capsule Espresso (50x)', 
            category: 'Vessel Choice', 
            price: '€18.90', 
            icon: Coffee,
            color: 'text-amber-700',
            bg: 'bg-amber-50',
            desc: 'Miscela intensa per turni notturni.',
            url: 'https://www.nespresso.com/it/it/ordine/capsule'
        },
        { 
            name: 'Stivali Deck S3', 
            category: 'Safety Gear', 
            price: '€85.00', 
            icon: Shield,
            color: 'text-slate-700',
            bg: 'bg-slate-100',
            desc: 'Impermeabili e antiscivolo.',
            url: 'https://www.heltess.it/calzature-antinfortunistiche'
        },
    ];

    const news = [
        {
            title: 'Allerta Meteo - Settore B7',
            content: 'Prevista burrasca nelle prossime 12 ore. Assicurare il carico in coperta entro le 18:00 LT.',
            type: 'warning',
            time: '2 ore fa'
        },
        {
            title: 'Nuove Procedure Radio',
            content: 'Dal 1° Aprile il canale di servizio passerà al VHF 72 per le operazioni di scarico.',
            type: 'info',
            time: 'Oggi 09:15'
        }
    ];

    return (
        <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* TOP NEWS TICKET */}
            <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between px-1 mb-2">
                    <h3 className="text-[10px] font-black text-on-surface/40 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Bell size={12} className="text-primary" /> Ultime News
                    </h3>
                    <span className="text-[9px] font-black text-primary uppercase">Vedi tutte</span>
                </div>
                
                {news.map((n, i) => (
                    <div key={i} className={`p-4 rounded-2xl border ${n.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'} shadow-sm`}>
                        <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-[13px] font-black uppercase tracking-tight ${n.type === 'warning' ? 'text-amber-700' : 'text-blue-700'}`}>{n.title}</h4>
                            <span className="text-[9px] font-bold opacity-40">{n.time}</span>
                        </div>
                        <p className={`text-[11px] leading-relaxed font-bold ${n.type === 'warning' ? 'text-amber-900/70' : 'text-blue-900/70'}`}>{n.content}</p>
                    </div>
                ))}
            </div>

            {/* MARKETPLACE SECTION */}
            <div className="bg-surface-lowest rounded-3xl p-5 border border-surface-low/30 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-manrope font-black text-on-surface tracking-tight leading-none mb-1">Crew Corner</h3>
                        <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-[0.15em]">Consigli per la vita a bordo</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <ShoppingBag size={20} />
                    </div>
                </div>

                <div className="space-y-4">
                    {products.map((p, i) => (
                        <div key={i} className="flex gap-4 p-3 bg-white rounded-[2rem] border border-surface-low/30 shadow-sm active:scale-[0.98] transition-all">
                            <div className={`w-20 h-20 rounded-2xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                                <p.icon size={32} className={p.color} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">{p.category}</span>
                                        <div className="flex items-center gap-0.5 text-amber-400">
                                            <Star size={8} fill="currentColor" />
                                            <span className="text-[9px] font-bold text-on-surface/40">4.9</span>
                                        </div>
                                    </div>
                                    <h4 className="text-[13px] font-black text-on-surface uppercase tracking-tight mt-0.5">{p.name}</h4>
                                    <p className="text-[10px] text-on-surface/40 font-bold leading-tight mt-1">{p.desc}</p>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-sm font-manrope font-black text-on-surface">{p.price}</span>
                                    <button 
                                        onClick={() => window.open(p.url, '_blank')}
                                        className="bg-primary hover:bg-primary/90 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg shadow-lg shadow-primary/20 flex items-center gap-1 active:scale-95 transition-all"
                                    >
                                        Ordina <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        <Info size={20} />
                    </div>
                    <p className="text-[10px] font-bold text-on-surface/60 leading-tight">
                        Questi prodotti sono suggeriti per migliorare la qualità del lavoro. Gli ordini verranno inoltrati al fornitore convenzionato.
                    </p>
                </div>
            </div>

            {/* SPONSOR / NEWS BANNER */}
            <div className="mt-6 relative rounded-3xl overflow-hidden h-32 bg-slate-900 flex items-center justify-center">
                <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-primary to-secondary" />
                <div className="relative text-center p-4">
                    <Zap size={24} className="text-amber-400 mx-auto mb-2" />
                    <h4 className="text-white font-manrope font-black text-sm uppercase tracking-tight leading-none mb-1">Assicurazione Crew Plus</h4>
                    <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest">Protezione extra per la tua famiglia a soli 10€/mese</p>
                    <button 
                        onClick={() => window.open('https://www.unipolsai.it/polizze-vita/previdenza-e-risparmio', '_blank')}
                        className="mt-2 text-[8px] font-black text-primary bg-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                    >
                        Scopri di più
                    </button>
                </div>
            </div>
        </div>
    );
}
