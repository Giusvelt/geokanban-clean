import React from 'react';
import { 
  Anchor, Activity, Target, Database, Edit3, 
  Calendar, Rewind, Users, Menu, X, LogOut, User 
} from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useData } from '../context/DataContext';
import { can } from '../lib/permissions';

export default function MobileDashboard({ 
  onSignOut, activeTab, setActiveTab, children, navItems = [],
  aisTotal, aisSubmitted
}) {
  const { profile } = useUserProfile();
  const { activities } = useData();
  
  const totalMsgs = (activities || []).reduce((sum, a) => sum + (a.msgCount || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-surface font-inter">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface/80 backdrop-blur-xl border-b border-surface-low/50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
            <Anchor size={20} weight="bold" />
          </div>
          <span className="font-manrope font-extrabold text-xl tracking-tight text-on-surface">
            GeoKanban <span className="text-[10px] font-bold text-primary/40 align-top ml-1">v3.13</span>
          </span>
        </div>
        
        <button 
          onClick={onSignOut}
          className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/70 active:bg-surface-container-high transition-colors"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20 pb-24 overflow-y-auto px-4">
        <div className="mb-6 px-2">
            <h1 className="font-manrope font-extrabold text-2xl text-on-surface">
                {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p className="text-sm text-on-surface/60 font-medium tracking-wide">
                FLEET COMMAND · {profile?.role?.toUpperCase()}
            </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-lowest/90 backdrop-blur-2xl border-t border-surface-low/30 px-2 pb-6 pt-3 flex justify-around items-center h-22 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const hasNotifications = (item.id === 'activity' || item.id === 'chat') && totalMsgs > 0;
          
          let subLabel = null;
          if (item.id === 'activity' && aisTotal > 0) subLabel = aisTotal;
          if (item.id === 'logbook-entry' && aisTotal > 0) subLabel = `${aisSubmitted}/${aisTotal}`;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center gap-1 group transition-all duration-300 ${
                isActive ? 'text-primary' : 'text-on-surface/40'
              }`}
            >
              <div className={`
                p-2 rounded-xl transition-all duration-300 
                ${isActive ? 'bg-primary/10 scale-110 shadow-sm' : 'group-active:scale-95'}
              `}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {hasNotifications && (
                  <span className="absolute top-1 right-2 w-4 h-4 bg-secondary text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-surface-lowest">
                    {totalMsgs > 9 ? '9+' : totalMsgs}
                  </span>
                )}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                {item.label.split(' ')[0]}
              </span>
              {subLabel && (
                <span className={`text-[9px] font-black leading-none ${isActive ? 'text-primary' : 'text-on-surface/30'}`}>
                    {subLabel}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
