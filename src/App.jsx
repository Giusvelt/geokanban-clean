import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DataProvider, useFleet, useOperations } from './context/DataContext';
import { supabase } from './lib/supabase';
import { useUserProfile } from './hooks/useUserProfile';
import { useSessionLock } from './hooks/useSessionLock';
import { can, ROLES } from './lib/permissions';
const LandingPage            = lazy(() => import('./components/LandingPage'));
const VesselMap               = lazy(() => import('./components/VesselMap'));
const TelemetryStatusIndicator = lazy(() => import('./components/TelemetryStatusIndicator'));
const WeatherStatusIndicator  = lazy(() => import('./components/WeatherStatusIndicator'));
import TabLoadingSkeleton from './components/TabLoadingSkeleton';



const VesselActivityTab = lazy(() => import('./components/VesselActivityTab'));
const ProductionTargetTab = lazy(() => import('./components/ProductionTargetTab'));
const DBManager = lazy(() => import('./components/DBManager'));
const LogbookWriterTab = lazy(() => import('./components/LogbookWriterTab'));
const StandbySchedule = lazy(() => import('./components/StandbySchedule'));
const RewindMapTab = lazy(() => import('./components/RewindMapTab'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const WeatherAnalyticsTab = lazy(() => import('./components/WeatherAnalyticsTab'));
const DigitalTwinCopilotTab = lazy(() => import('./components/DigitalTwinCopilotTab'));

const MobileDashboard = lazy(() => import('./components/MobileDashboard'));
const MobileCrewActivity = lazy(() => import('./components/MobileCrewActivity'));
const MobileOperatorChat = lazy(() => import('./components/MobileOperatorChat'));
const MobileCrewProfile = lazy(() => import('./components/MobileCrewProfile'));
const MobileCrewNews = lazy(() => import('./components/MobileCrewNews'));
const YardForecastsTab = lazy(() => import('./components/YardForecastsTab'));

import TelemetryAlertBanner from './components/TelemetryAlertBanner';


import { Anchor, Activity, Target, Database, Edit3, Calendar, Rewind, Users, User, MessageSquare, Map as MapIcon, Bell, Cloud, Bot } from 'lucide-react';
import logoGk from './assets/logo_gk.png';
import './index.css';
import { useUIStore } from './store/useUIStore';

function ActivityDashboard({ onSignOut }) {
  const { companyVesselIds, crewVesselId, vesselPositions, geofences } = useFleet();
  const { activities, schedules, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useOperations();
  const { profile, updateProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState('activity');
  const [mobileTab, setMobileTab] = useState('fleet');
  const [showProfile, setShowProfile] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const now = new Date();
  const [vesselFilter, setVesselFilter] = useState('All');

  useEffect(() => {
    if (profile?.role === 'crew') {
      setMobileTab('activity');
    } else {
      setMobileTab('fleet');
    }
  }, [profile?.role]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const perms = profile?.permissions || can(profile?.role);

  const { aisTotal, aisSubmitted } = React.useMemo(() => {
    if (!activities) return { aisTotal: 0, aisSubmitted: 0 };
    const filtered = activities.filter(a => {
        const d = new Date(a.startTime);
        const matchesTime = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        if (!matchesTime) return false;
        if (perms.seeCompanyVessels && companyVesselIds && !companyVesselIds.includes(a.vesselId)) return false;
        if (perms.seeOwnVesselOnly && crewVesselId && a.vesselId !== crewVesselId) return false;
        if (vesselFilter !== 'All' && a.vessel !== vesselFilter) return false;
        return true;
    });
    const submitted = filtered.filter(a => ['submitted', 'approved'].includes(a.logbookStatus)).length;
    return { aisTotal: filtered.length, aisSubmitted: submitted };
  }, [activities, selectedMonth, selectedYear, perms, companyVesselIds, crewVesselId, vesselFilter]);

  const offHireVessels = React.useMemo(() => {
      if (!schedules) return {};
      const todayStr = new Date().toISOString().split('T')[0];
      const offHires = {};
      schedules.forEach(s => {
          // Check if schedule is today and it's off hire (handle spaces, dashes, and underscores)
          const name = s.standby_reasons?.name?.toLowerCase() || '';
          const code = s.standby_reasons?.code?.toLowerCase() || '';
          
          if (s.standby_date === todayStr && (name.includes('off hire') || name.includes('off-hire') || code.includes('off_hire'))) {
              offHires[s.vessel_id] = true;
          }
      });
      return offHires;
  }, [schedules]);

  const renderTabContent = () => {
    const commonProps = { vesselFilter, setVesselFilter };
    return (
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="w-full">
          <Suspense fallback={<TabLoadingSkeleton />}>
            {(() => {
              switch(activeTab) {
                case 'activity': return <VesselActivityTab view="to-submit" {...commonProps} />;
                case 'logbook-entry': return <VesselActivityTab view="submitted" {...commonProps} />;
                case 'schedule': return <StandbySchedule />;
                case 'rewind': return <RewindMapTab />;
                case 'production': return <ProductionTargetTab />;
                case 'dbmanager': return <DBManager />;

                case 'weather-analytics': return <WeatherAnalyticsTab />;
                case 'yard-forecasts': return <YardForecastsTab />;
                case 'copilot': return <DigitalTwinCopilotTab />;
                default: return <VesselActivityTab {...commonProps} />;
              }
            })()}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    );
  };

  const showMobile = (profile?.role === ROLES.CREW || [ROLES.OPERATION, ROLES.OPERATION_ADMIN].includes(profile?.role)) && isMobile;

  const mobileNavItems = [
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'logbook-entry', label: 'Logbook', icon: Edit3, permission: perms.submitLogbook },
    { id: 'fleet', label: 'Fleet', icon: MapIcon },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ].filter(item => item.permission !== false);

  if (showMobile) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Anchor size={48} className="animate-spin text-primary opacity-20" /></div>}>
        <MobileDashboard 
          onSignOut={onSignOut} 
          activeTab={mobileTab} 
          setActiveTab={setMobileTab} 
          aisTotal={aisTotal} 
          aisSubmitted={aisSubmitted}
          navItems={mobileNavItems}
        >
          {mobileTab === 'activity' && <MobileCrewActivity tab="all" />}
          {mobileTab === 'logbook-entry' && <MobileCrewActivity tab="submitted" />}
          {mobileTab === 'schedule' && <StandbySchedule />}
          {mobileTab === 'fleet' && <div className="h-[60vh] rounded-xl overflow-hidden shadow-lg border border-surface-low/50"><VesselMap height="100%" offHireVessels={offHireVessels} /></div>}
          {mobileTab === 'chat' && <MobileOperatorChat profile={profile} />}
          {mobileTab === 'profile' && <MobileCrewProfile />}
        </MobileDashboard>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-manrope text-on-surface selection:bg-primary/20">
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-surface-low/30 h-16 sm:h-20 lg:h-24 px-6 sm:px-10 lg:px-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 border border-white/20"><Anchor className="text-white w-6 h-6 lg:w-8 lg:h-8" /></div>
          <div className="flex flex-col">
            <h1 className="font-manrope font-extrabold text-xl lg:text-2xl text-on-surface tracking-tight leading-none mb-1">GeoKanban <span className="text-[10px] font-bold text-primary/40 align-top ml-1">v3.25</span></h1>
            <p className="text-[10px] lg:text-xs font-black text-primary uppercase tracking-[0.2em] opacity-80 leading-none">Breakwater Fleet Tracker — Genova</p>
          </div>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          {profile && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-extrabold text-on-surface leading-none mb-1">{profile.displayName}</span>
              <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest leading-none">{profile.role?.replace('_', ' ')}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Suspense fallback={null}><TelemetryStatusIndicator /></Suspense>
            <Suspense fallback={null}><WeatherStatusIndicator /></Suspense>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-surface-low to-surface-lowest flex items-center justify-center border border-white shadow-sm active:scale-90 transition-transform"><div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary lg:text-lg">{(profile?.displayName || 'G')[0]}</div></button>
        </div>
      </header>

      <main className="pt-20 sm:pt-24 lg:pt-28 px-6 sm:px-10 lg:px-16 max-w-[2100px] mx-auto pb-12">
        <TelemetryAlertBanner />
        {activeTab === 'activity' && (
          <div className="mb-8 bg-white/50 backdrop-blur-md rounded-[2.5rem] p-4 border border-white shadow-sm">
            <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-sky-50 rounded-full w-fit border border-sky-200 shadow-sm">
              <div className="w-2 h-2 bg-sky-500 rounded-full" />
              <span className="text-[10px] font-black text-sky-700 uppercase tracking-widest leading-none">T+1 Certified Historical Tracker</span>
            </div>
            <div className="rounded-[1.5rem] overflow-hidden border border-surface-low/20">
              <Suspense fallback={<div className="h-[350px] rounded-[1.5rem] bg-slate-100 animate-pulse" />}>
                <VesselMap height="350px" vesselPositions={vesselPositions} geofences={geofences} offHireVessels={offHireVessels} />
              </Suspense>
            </div>
          </div>
        )}

        <nav className="bg-white/50 backdrop-blur-md rounded-[2.5rem] p-2 mb-8 sm:mb-12 border border-white flex flex-wrap items-center gap-1 shadow-sm overflow-x-auto scrollbar-hide relative z-[100]">
          {[
            { id: 'activity', label: 'Vessel Activities', icon: Activity, subLabel: aisTotal > 0 ? `${aisTotal}` : null },
            { id: 'logbook-entry', label: 'Submitted Logbooks', icon: Edit3, subLabel: aisTotal > 0 ? `${aisSubmitted}/${aisTotal}` : null, permission: perms.seeSubmittedLogbooks },
            { id: 'yard-forecasts', label: 'Yard Forecasts', icon: Cloud, permission: perms.seeWeatherAnalytics },
            { id: 'copilot', label: 'Copilot AI', icon: Bot, permission: perms.seeCopilot },
            { 
              id: 'schedule', 
              label: 'Schedule', 
              icon: Calendar, 
              permission: perms.seeSchedule,
              hasNotification: !perms.seeOwnVesselOnly && (schedules || []).some(s => s.is_approved === false || s.is_approved === null)
            },
            { id: 'rewind', label: 'Rewind', icon: Rewind, permission: perms.seeRewindMap },
            { id: 'production', label: 'Production Targets', icon: perms.seeProductionTargets ? Target : null, permission: perms.seeProductionTargets },
            { id: 'weather-analytics', label: 'Weather Analytics', icon: Cloud, permission: perms.seeWeatherAnalytics },

            { id: 'dbmanager', label: 'DB Manager', icon: Database, permission: perms.accessDBManager },
          ].filter(item => item.permission !== false).map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center min-w-[120px] lg:min-w-[160px] px-4 lg:px-6 py-3 lg:py-4 rounded-[2rem] tracking-tight transition-all duration-300 relative ${activeTab === item.id ? 'bg-primary text-white shadow-lg' : 'text-on-surface/50 hover:text-on-surface'}`}>
              <div className="flex items-center gap-2 lg:gap-3">
                <item.icon size={16} />
                <span className="text-xs lg:text-sm font-extrabold">{item.label}</span>
                {item.hasNotification && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center animate-pulse">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                )}
              </div>
              {item.subLabel && <span className={`text-[10px] font-black mt-1 opacity-60 ${activeTab === item.id ? 'text-white' : 'text-primary'}`}>{item.subLabel}</span>}
            </button>
          ))}
        </nav>

        <div className="tab-content-container">{renderTabContent()}</div>
      </main>

      {showProfile && <Suspense fallback={null}><ProfileModal profile={profile} onClose={() => setShowProfile(false)} onSignOut={onSignOut} updateProfile={updateProfile} /></Suspense>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const handleSession = async (session) => {
      if (!session?.user) {
        setUser(null);
        setCheckingAuth(false);
        return;
      }

      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
      const role = profile?.role || 'crew';

      setUser({ id: session.user.id, email: session.user.email, role: role });
      setCheckingAuth(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user || _event === 'SIGNED_OUT') setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checkingAuth) return <div className="loading-screen"><Anchor size={48} className="spin" /><p>Loading...</p></div>;
  if (!user) return <Suspense fallback={null}><LandingPage onLogin={setUser} /></Suspense>;
  return <DataProvider><ActivityDashboard onSignOut={() => supabase.auth.signOut()} /></DataProvider>;
}
