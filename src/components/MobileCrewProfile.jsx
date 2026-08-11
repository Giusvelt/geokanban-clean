import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Ship, Save, Edit3, CheckCircle, AlertCircle, Anchor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserProfile } from '../hooks/useUserProfile';
import { useData } from '../context/DataContext';

export default function MobileCrewProfile() {
  const { profile, loading: profileLoading, updateProfile } = useUserProfile();
  const { vessels, loading: dataLoading } = useData();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const loading = profileLoading || dataLoading;

  const [form, setForm] = useState({
    display_name: '',
    email: '',
    phone: '',
    mmsi: '',
    vessel_id: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.displayName || '',
        email: profile.email || '',
        phone: profile.phoneNumber || '',
        mmsi: profile.mmsi || '',
        vessel_id: profile.vesselId || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!form.email.trim()) {
      setError('Il campo Email è obbligatorio.');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: saveError } = await updateProfile({
        displayName: form.display_name,
        phoneNumber: form.phone,
        mmsi: form.mmsi,
        vesselId: form.vessel_id || null,
      });

    setSaving(false);
    if (saveError) {
      setError('Errore nel salvataggio. Riprova.');
    } else {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const myVessel = vessels?.find(v => v.id === (profile?.vesselId || form.vessel_id));

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-black text-on-surface/30 uppercase tracking-widest">Caricamento Profilo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">

      {/* Avatar Header */}
      <div className="flex flex-col items-center pt-4 pb-6 gap-3">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
          <span className="text-white font-manrope font-extrabold text-3xl">
            {(profile?.displayName || 'C')[0].toUpperCase()}
          </span>
        </div>
        <div className="text-center">
          <h2 className="font-manrope font-extrabold text-xl text-on-surface">{profile?.displayName || 'Crew Member'}</h2>
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            {profile?.role?.replace('_', ' ')}
          </span>
        </div>
        {myVessel && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 px-4 py-2 rounded-full">
            <Ship size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary">{myVessel.name}</span>
          </div>
        )}
      </div>

      {/* Success/Error Banner */}
      {saved && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 animate-in fade-in duration-300">
          <CheckCircle size={18} />
          <span className="font-bold text-sm">Profilo salvato con successo!</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">
          <AlertCircle size={18} />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-surface-lowest rounded-2xl shadow-sm border border-surface-low/30 overflow-hidden">
        
        {/* Section Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-low/30">
          <h3 className="font-manrope font-extrabold text-sm text-on-surface uppercase tracking-widest">
            Informazioni di Contatto
          </h3>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all
              ${editing
                ? 'bg-primary text-white shadow-md shadow-primary/30 active:scale-95'
                : 'bg-surface-low text-on-surface/60 active:bg-surface-low/80'
              }
            `}
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : editing ? (
              <><Save size={13} /> Salva</>
            ) : (
              <><Edit3 size={13} /> Modifica</>
            )}
          </button>
        </div>

        {/* Fields */}
        <div className="divide-y divide-surface-low/30">

          {/* Nome */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
              <User size={17} className="text-primary/60" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Nome Cognome</p>
              {editing ? (
                <input
                  type="text"
                  value={form.display_name}
                  onChange={e => setForm({ ...form, display_name: e.target.value })}
                  className="w-full bg-surface-low border-none rounded-lg px-3 py-2 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Es. Marco Rossi"
                />
              ) : (
                <p className="text-sm font-bold text-on-surface">{form.display_name || '—'}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
              <Mail size={17} className="text-primary/60" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest">Email</p>
                <span className="text-[8px] font-black text-red-400 uppercase">Obbligatoria</span>
              </div>
              <p className="text-sm font-bold text-on-surface">{profile?.email || form.email || '—'}</p>
              <p className="text-[10px] text-on-surface/30 mt-0.5">Modificabile solo dall'admin</p>
            </div>
          </div>

          {/* Telefono */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
              <Phone size={17} className="text-primary/60" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest">Telefono</p>
                <span className="text-[8px] font-black text-on-surface/20 uppercase">Facoltativo</span>
              </div>
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-surface-low border-none rounded-lg px-3 py-2 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="+39 320 000 0000"
                />
              ) : (
                <p className="text-sm font-bold text-on-surface">{form.phone || '—'}</p>
              )}
            </div>
          </div>

          {/* MMSI */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
              <Anchor size={17} className="text-primary/60" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-1">MMSI Nave Assegnata</p>
              {editing ? (
                <input
                  type="text"
                  value={form.mmsi}
                  onChange={e => setForm({ ...form, mmsi: e.target.value })}
                  className="w-full bg-surface-low border-none rounded-lg px-3 py-2 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Es. 247123456"
                />
              ) : (
                <p className="text-sm font-bold text-on-surface">{form.mmsi || '—'}</p>
              )}
            </div>
          </div>

          {/* Nave assegnata */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
              <Ship size={17} className="text-primary/60" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Nave Assegnata</p>
              {editing ? (
                <select
                  value={form.vessel_id}
                  onChange={e => setForm({ ...form, vessel_id: e.target.value })}
                  className="w-full bg-surface-low border-none rounded-lg px-3 py-2 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Seleziona nave...</option>
                  {(vessels || []).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm font-bold text-on-surface">{myVessel?.name || '—'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Button */}
      {editing && (
        <button
          onClick={() => { setEditing(false); setError(null); }}
          className="w-full py-3 rounded-xl border-2 border-surface-low text-on-surface/50 font-black text-sm uppercase tracking-widest active:bg-surface-low transition-colors"
        >
          Annulla
        </button>
      )}
    </div>
  );
}
