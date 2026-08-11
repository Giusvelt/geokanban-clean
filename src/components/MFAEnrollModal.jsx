import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Check, AlertCircle, X, Loader, Smartphone } from 'lucide-react';

/**
 * MFAEnrollModal — Guida l'utente attraverso l'iscrizione TOTP (prima volta).
 * Mostra il QR code da scannerizzare con Google Authenticator / Authy,
 * poi richiede il codice per confermare l'iscrizione.
 */
export default function MFAEnrollModal({ onEnrolled, onSkip, canSkip = false }) {
    const [step, setStep] = useState('loading'); // loading | qr | verify | done
    const [factorId, setFactorId] = useState(null);
    const [challengeId, setChallengeId] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [secret, setSecret] = useState(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        startEnrollment();
    }, []);

    const startEnrollment = async () => {
        setStep('loading');
        try {
            const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'GeoKanban',
                friendlyName: 'GeoKanban Authenticator'
            });
            if (enrollErr) throw enrollErr;

            setFactorId(data.id);
            setQrCode(data.totp.qr_code);
            setSecret(data.totp.secret);
            setStep('qr');
        } catch (err) {
            setError(err.message);
            setStep('qr');
        }
    };

    const handleProceedToVerify = async () => {
        setLoading(true);
        try {
            const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
            if (challengeErr) throw challengeErr;
            setChallengeId(challenge.id);
            setStep('verify');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId,
                challengeId,
                code: code.trim()
            });
            if (verifyErr) throw verifyErr;
            setStep('done');
            setTimeout(() => onEnrolled?.(), 1500);
        } catch (err) {
            setError('Invalid code. Check your Authenticator app and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', padding: '32px',
                width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                        }}>
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Enable 2-Factor Auth</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Secure your GeoKanban account</p>
                        </div>
                    </div>
                    {canSkip && <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>}
                </div>

                {/* Step: Loading */}
                {step === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Loader size={32} className="spin" style={{ color: '#10b981' }} />
                        <p style={{ color: '#64748b', marginTop: '16px' }}>Preparing authenticator...</p>
                    </div>
                )}

                {/* Step: QR Code */}
                {step === 'qr' && (
                    <div>
                        <div style={{
                            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
                            padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start'
                        }}>
                            <Smartphone size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                            <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: 1.5 }}>
                                <strong>Step 1:</strong> Install <strong>Google Authenticator</strong> or <strong>Authy</strong> on your phone.<br />
                                <strong>Step 2:</strong> Scan the QR code below with the app.
                            </p>
                        </div>

                        {qrCode && (
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <img
                                    src={qrCode}
                                    alt="TOTP QR Code"
                                    style={{ width: '180px', height: '180px', border: '4px solid #e2e8f0', borderRadius: '8px' }}
                                />
                            </div>
                        )}

                        {secret && (
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginBottom: '6px' }}>
                                    Or enter this code manually:
                                </p>
                                <div style={{
                                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
                                    padding: '8px 12px', fontFamily: 'monospace', fontSize: '14px',
                                    textAlign: 'center', letterSpacing: '0.1em', color: '#1e293b', wordBreak: 'break-all'
                                }}>
                                    {secret}
                                </div>
                            </div>
                        )}

                        {error && <div className="login-error" style={{ marginBottom: '16px' }}><AlertCircle size={14} /> {error}</div>}

                        <button
                            onClick={handleProceedToVerify}
                            disabled={loading || !factorId}
                            style={{
                                width: '100%', padding: '12px', background: '#10b981', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: '700',
                                fontSize: '15px', cursor: 'pointer'
                            }}
                        >
                            {loading ? 'Loading...' : "I've scanned it — Continue"}
                        </button>
                    </div>
                )}

                {/* Step: Verify */}
                {step === 'verify' && (
                    <form onSubmit={handleVerify}>
                        <p style={{ color: '#475569', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
                            Enter the <strong>6-digit code</strong> now shown in your Authenticator app to confirm setup.
                        </p>
                        <div className="form-field" style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', display: 'block' }}>Verification Code</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px', fontSize: '26px', letterSpacing: '0.5em',
                                    textAlign: 'center', border: '2px solid #e2e8f0', borderRadius: '8px',
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {error && <div className="login-error" style={{ marginBottom: '16px' }}><AlertCircle size={14} /> {error}</div>}

                        <button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            style={{
                                width: '100%', padding: '12px', background: '#10b981', color: '#fff',
                                border: 'none', borderRadius: '8px', fontWeight: '700',
                                fontSize: '15px', cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                                opacity: code.length === 6 ? 1 : 0.6
                            }}
                        >
                            {loading ? 'Verifying...' : 'Activate 2FA'}
                        </button>
                    </form>
                )}

                {/* Step: Done */}
                {step === 'done' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <Check size={32} style={{ color: '#10b981' }} />
                        </div>
                        <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>2FA Activated!</h3>
                        <p style={{ color: '#64748b', fontSize: '14px' }}>
                            Your account is now protected.<br />You'll be redirected shortly.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
