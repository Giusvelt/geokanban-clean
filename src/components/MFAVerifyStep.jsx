import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, AlertCircle, Loader, ChevronLeft } from 'lucide-react';

/**
 * MFAVerifyStep — Step 2 del login TOTP
 * Mostrato dopo signInWithPassword quando Supabase richiede MFA.
 */
export default function MFAVerifyStep({ onVerified, onBack }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (code.length !== 6) {
            setError('Enter the 6-digit code from your Authenticator app.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            // 1. Get enrolled TOTP factors
            const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
            if (factorsErr) throw factorsErr;

            const totpFactor = factorsData?.totp?.[0];
            if (!totpFactor) throw new Error('No TOTP factor enrolled. Please contact your administrator.');

            // 2. Create challenge
            const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
                factorId: totpFactor.id
            });
            if (challengeErr) throw challengeErr;

            // 3. Verify code
            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: totpFactor.id,
                challengeId: challengeData.id,
                code: code.trim()
            });
            if (verifyErr) throw verifyErr;

            onVerified();
        } catch (err) {
            setError(err.message || 'Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo" style={{ color: '#10b981' }}>
                    <ShieldCheck size={36} />
                </div>
                <h1 className="login-title">Two-Factor Auth</h1>
                <p className="login-subtitle" style={{ marginBottom: '24px' }}>
                    Enter the 6-digit code from your<br />
                    <strong>Google Authenticator</strong> or <strong>Authy</strong> app.
                </p>

                <form onSubmit={handleVerify} className="login-form">
                    <div className="form-field">
                        <label>Authentication Code</label>
                        <div className="input-with-icon">
                            <ShieldCheck size={16} />
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                autoFocus
                                style={{ letterSpacing: '0.4em', fontSize: '22px', textAlign: 'center' }}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="login-error">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <button type="submit" className="login-btn" disabled={loading || code.length !== 6}>
                        {loading ? <><Loader size={14} className="spin" /> Verifying...</> : 'Verify & Sign In'}
                    </button>
                </form>

                <button
                    onClick={onBack}
                    style={{
                        marginTop: '16px', background: 'none', border: 'none',
                        color: '#64748b', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: '6px', fontSize: '13px'
                    }}
                >
                    <ChevronLeft size={14} /> Back to login
                </button>

                <p className="login-footer" style={{ marginTop: '16px' }}>
                    Code refreshes every 30 seconds
                </p>
            </div>
        </div>
    );
}
