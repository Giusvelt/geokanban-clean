import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Anchor, Lock, AlertCircle, User, Eye, EyeOff } from 'lucide-react';
import MFAVerifyStep from './MFAVerifyStep';
import MFAEnrollModal from './MFAEnrollModal';

/**
 * Login V2 — Supporta MFA TOTP a due passaggi.
 *
 * Flusso:
 *  1. Utente inserisce email + password → signInWithPassword
 *  2a. Se l'utente NON ha MFA → onLogin() direttamente (Assurance Level 1)
 *  2b. Se l'utente HA MFA → mostra MFAVerifyStep (richiede codice TOTP)
 *  2c. Se l'utente HA MFA ma non è iscritto → mostra MFAEnrollModal (prima volta)
 */
export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // step: 'credentials' | 'mfa-verify' | 'mfa-enroll'
    const [step, setStep] = useState('credentials');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            if (!data?.user) {
                setError('Login failed. Please try again.');
                setLoading(false);
                return;
            }

            // 1. Controlla se l'utente è bloccato
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('is_blocked, role')
                .eq('id', data.user.id)
                .single();

            if (profile?.is_blocked) {
                await supabase.auth.signOut();
                setError('Account sospeso. Contatta l\'amministratore.');
                setLoading(false);
                return;
            }

            // 2. Controlla se l'utente ha già fattori MFA iscritti
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const hasTotp = factorsData?.totp?.length > 0;

            if (hasTotp) {
                // Utente con MFA attivo → richiedi codice TOTP
                setStep('mfa-verify');
            } else {
                // Imponi la configurazione MFA a chi ha ruoli "amministrativi" o con molti permessi
                // TEMPORANEAMENTE DISABILITATO (Richiesto dall'utente)
                /*
                if (profile?.role === 'operation' || profile?.role === 'operation_admin' || profile?.role === 'crew_admin') {
                    setStep('mfa-enroll');
                } else {
                    // I "crew" (le navi) non sono obbligati a fare MFA, login molto più semplice!
                    completeLogin(data.user);
                }
                */
                completeLogin(data.user);
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const completeLogin = (user) => {
        if (!user) return;
        onLogin({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email.split('@')[0],
            role: user.user_metadata?.role || 'admin'
        });
    };

    const handleMFAVerified = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        completeLogin(user);
    };

    const handleBack = async () => {
        await supabase.auth.signOut();
        setStep('credentials');
        setError('');
    };

    // ── Step 2b: verifica TOTP ──
    if (step === 'mfa-verify') {
        return <MFAVerifyStep onVerified={handleMFAVerified} onBack={handleBack} />;
    }

    // ── Step 2c: iscrizione TOTP (prima volta) ──
    if (step === 'mfa-enroll') {
        return (
            <MFAEnrollModal
                canSkip={false}
                onEnrolled={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    completeLogin(user);
                }}
            />
        );
    }

    // ── Step 1: email + password ──
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden font-inter p-4">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px]" />

            <div className="w-full max-w-[420px] bg-surface-lowest rounded-xl shadow-[0_32px_64px_-16px_rgba(0,88,190,0.12)] p-10 relative z-10 border border-surface-low/30 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-container rounded-lg flex items-center justify-center text-white mb-6 shadow-lg shadow-primary/20 ring-4 ring-primary/5">
                        <Anchor size={40} weight="bold" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="font-manrope font-extrabold text-3xl tracking-tight text-on-surface">
                            GeoKanban <span className="text-primary">V3</span>
                        </h1>
                        <p className="text-on-surface/50 font-medium text-sm tracking-wide uppercase">
                            Kinetic Fleet Management
                        </p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black text-on-surface/40 uppercase tracking-widest pl-1">
                            Identification
                        </label>
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors">
                                <User size={18} />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="fleet.manager@novamarine.com"
                                className="w-full bg-surface-low/50 hover:bg-surface-low focus:bg-white border-none focus:ring-2 focus:ring-primary/20 rounded-lg py-3.5 pl-12 pr-4 text-[15px] font-medium transition-all outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-black text-on-surface/40 uppercase tracking-widest pl-1">
                            Security Key
                        </label>
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-surface-low/50 hover:bg-surface-low focus:bg-white border-none focus:ring-2 focus:ring-primary/20 rounded-lg py-3.5 pl-12 pr-12 text-[15px] font-medium transition-all outline-none"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/30 hover:text-primary transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-semibold border border-red-100 animate-in slide-in-from-top-2">
                            <AlertCircle size={18} className="shrink-0" /> 
                            <span>{error}</span>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary to-primary-container hover:brightness-110 active:scale-[0.98] text-white py-4 rounded-full font-manrope font-extrabold text-[15px] shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:active:scale-100"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Authorizing...</span>
                            </div>
                        ) : 'Enter Command Center'}
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t border-surface-low/50 text-center">
                    <p className="text-[10px] text-on-surface/30 font-bold uppercase tracking-[0.2em]">
                        Precision Engineering by Giusvelt
                    </p>
                </div>
            </div>
        </div>
    );
}
