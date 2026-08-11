import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function SectionHeader({ 
    title, 
    subtitle, 
    icon: Icon, 
    onRefresh, 
    loading, 
    actions 
}) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 px-2 animate-in fade-in slide-in-from-left duration-700">
            <div className="flex items-start gap-4">
                {Icon && (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-primary shadow-sm border border-white">
                        <Icon size={24} />
                    </div>
                )}
                <div>
                    <h2 className="font-manrope font-black text-3xl text-on-surface tracking-tight uppercase leading-none mb-2">
                        {title}
                    </h2>
                    <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-[0.2em] leading-none">
                        {subtitle}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {onRefresh && (
                    <button 
                        onClick={onRefresh}
                        className={`w-10 h-10 rounded-full bg-white border border-surface-low/30 flex items-center justify-center text-on-surface/20 hover:text-primary transition-all active:scale-95 ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={18} />
                    </button>
                )}
                {actions}
            </div>
        </div>
    );
}
