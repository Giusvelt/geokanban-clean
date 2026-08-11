import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Anchor, Lock, AlertCircle, User, Eye, EyeOff, ChevronDown, Satellite, Ship, Cloud, Database as DbIcon, Globe, BarChart3, Shield, Cpu, Layers, Box, Mail, ArrowRight, Activity, Target, MapPin } from 'lucide-react';
import MFAVerifyStep from './MFAVerifyStep';
import MFAEnrollModal from './MFAEnrollModal';
import '../landing.css';

/**
 * GeoKanban Landing Page — Blueprint-inspired showcase + Login
 * Replaces the old minimal Login component with a full-page experience.
 */
export default function LandingPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('credentials');
    const [showLogin, setShowLogin] = useState(false);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ── Auth Logic (preserved from Login.jsx) ──
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) { setError(authError.message); setLoading(false); return; }
            if (!data?.user) { setError('Login failed. Please try again.'); setLoading(false); return; }

            const { data: profile } = await supabase.from('user_profiles').select('is_blocked, role').eq('id', data.user.id).single();
            if (profile?.is_blocked) { await supabase.auth.signOut(); setError('Account sospeso. Contatta l\'amministratore.'); setLoading(false); return; }

            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const hasTotp = factorsData?.totp?.length > 0;
            if (hasTotp) { setStep('mfa-verify'); }
            else if (profile?.role === 'operation' || profile?.role === 'operation_admin' || profile?.role === 'crew_admin') { setStep('mfa-enroll'); }
            else { completeLogin(data.user); }
        } catch (err) { setError('Connection error. Please try again.'); } finally { setLoading(false); }
    };

    const completeLogin = (user) => {
        if (!user) return;
        onLogin({ id: user.id, email: user.email, name: user.user_metadata?.name || user.email.split('@')[0], role: user.user_metadata?.role || 'admin' });
    };

    const handleMFAVerified = async () => { const { data: { user } } = await supabase.auth.getUser(); completeLogin(user); };
    const handleBack = async () => { await supabase.auth.signOut(); setStep('credentials'); setError(''); };

    if (step === 'mfa-verify') return <MFAVerifyStep onVerified={handleMFAVerified} onBack={handleBack} />;
    if (step === 'mfa-enroll') return <MFAEnrollModal canSkip={false} onEnrolled={async () => { const { data: { user } } = await supabase.auth.getUser(); completeLogin(user); }} />;

    // ── Feature Cards Data ──
    const features = [
        { icon: <Ship size={24} />, title: "Live Fleet Tracking", desc: "Real-time AIS vessel tracking with geofencing, automatic activity detection and operational status monitoring." },
        { icon: <Box size={24} />, title: "3D Asset Viewer", desc: "Potree-based point cloud visualization for subsea infrastructure inspection, bathymetric surveys and structural monitoring." },
        { icon: <BarChart3 size={24} />, title: "Production Analytics", desc: "Dynamic KPI engine with database-driven calculations. Track delivered volumes, cycle times and production targets." },
        { icon: <Shield size={24} />, title: "Certified Logbook", desc: "Digital logbook with signature protocol, MFA-secured submissions and immutable audit trail for maritime compliance." },
        { icon: <Globe size={24} />, title: "Geospatial Intelligence", desc: "Multi-layer spatial analysis with geofence-based event detection. Automatic ENTER/EXIT tracking for fleet operations." },
        { icon: <Activity size={24} />, title: "Operational Rewind", desc: "Historical playback of vessel movements. Reconstruct past operations with timeline-based navigation and route visualization." },
    ];

    const principles = [
        { icon: <Globe size={20} />, title: "Holistic View", desc: "Unify data, context and operations" },
        { icon: <Activity size={20} />, title: "Real-Time", desc: "Act in the present, with awareness of change" },
        { icon: <BarChart3 size={20} />, title: "Data-Driven", desc: "Decisions backed by quality data and insights" },
        { icon: <Cpu size={20} />, title: "Adaptive", desc: "Evolve with operational needs and technology" },
        { icon: <Target size={20} />, title: "Sustainable", desc: "Optimize for efficiency and environment" },
    ];

    const systemLayers = [
        { label: "Decision Layer", desc: "Strategy & Governance · Human / AI Collaboration", color: "#60a5fa" },
        { label: "Intelligence Layer", desc: "Analytics & Insights · AI / Machine Learning", color: "#38bdf8" },
        { label: "Information Layer", desc: "Data Models & Context · Semantic Integration", color: "#22d3ee" },
        { label: "Data Layer", desc: "Acquisition & Storage · Raw Data Streams", color: "#2dd4bf" },
    ];

    return (
        <div className="landing-page">
            {/* ═══════════════════════════════════════════════════
                NAVIGATION BAR (Fixed)
            ═══════════════════════════════════════════════════ */}
            <nav className={`landing-nav ${scrollY > 50 ? 'landing-nav--scrolled' : ''}`}>
                <div className="landing-nav__inner">
                    <div className="landing-nav__brand">
                        <div className="landing-nav__logo">
                            <Anchor size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="landing-nav__title">GeoKanban</span>
                            <span className="landing-nav__version">V3</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ml-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                T+1 Certified Historical Mode
                            </span>
                        </div>
                    </div>
                    <div className="landing-nav__links">
                        <a href="#features" className="landing-nav__link">Features</a>
                        <a href="#architecture" className="landing-nav__link">Architecture</a>
                        <a href="#contact" className="landing-nav__link">Contact</a>
                        <button onClick={() => setShowLogin(!showLogin)} className="landing-nav__cta">
                            Command Center
                        </button>
                    </div>
                </div>
            </nav>

            {/* ═══════════════════════════════════════════════════
                LOGIN DROPDOWN
            ═══════════════════════════════════════════════════ */}
            {showLogin && (
                <div className="landing-login-overlay" onClick={() => setShowLogin(false)}>
                    <div className="landing-login-panel" onClick={e => e.stopPropagation()}>
                        <h3 className="landing-login-panel__title">
                            <Lock size={16} /> Command Center Access
                        </h3>
                        <form onSubmit={handleLogin} className="landing-login-panel__form">
                            <div className="landing-input-group">
                                <User size={16} className="landing-input-icon" />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fleet.manager@company.com" required />
                            </div>
                            <div className="landing-input-group">
                                <Lock size={16} className="landing-input-icon" />
                                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="landing-eye-btn">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {error && (
                                <div className="landing-error">
                                    <AlertCircle size={14} /> {error}
                                </div>
                            )}
                            <button type="submit" disabled={loading} className="landing-submit-btn">
                                {loading ? <div className="landing-spinner" /> : 'Authorize'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════
                HERO SECTION
            ═══════════════════════════════════════════════════ */}
            <section className="landing-hero">
                <div className="landing-hero__grid-bg" />
                <div className="landing-hero__propeller" style={{ transform: `rotate(${scrollY * 0.05}deg)` }}>
                    <img src="/landing/propeller_hero.png" alt="" />
                </div>
                <div className="landing-hero__content">
                    <div className="landing-hero__badge">Maritime Digital Twin Platform — T+1 Certified Historical Mode</div>
                    <h1 className="landing-hero__title">
                        Propelling the Future of<br />
                        <span className="landing-hero__title--accent">Harbor Operations</span>
                    </h1>
                    <p className="landing-hero__subtitle">
                        One platform. Connecting data, space and operations for smarter harbors.
                        GeoKanban V3 integrates real-time fleet tracking, 3D infrastructure monitoring
                        and production analytics into a unified command center.
                    </p>
                    <div className="landing-hero__actions">
                        <button onClick={() => setShowLogin(true)} className="landing-btn landing-btn--primary">
                            Enter Command Center <ArrowRight size={18} />
                        </button>
                        <a href="#features" className="landing-btn landing-btn--ghost">
                            Explore Features <ChevronDown size={18} />
                        </a>
                    </div>
                </div>
                <div className="landing-hero__visual">
                    <img src="/landing/pointcloud_breakwater.png" alt="3D Point Cloud" className="landing-hero__cloud-img" />
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                INPUT STREAMS BAR
            ═══════════════════════════════════════════════════ */}
            <section className="landing-streams">
                <div className="landing-streams__inner">
                    {[
                        { icon: <Satellite size={20} />, label: "Satellite Data" },
                        { icon: <Cpu size={20} />, label: "Sensor Data" },
                        { icon: <Ship size={20} />, label: "Vessel Data" },
                        { icon: <Cloud size={20} />, label: "Weather Data" },
                        { icon: <MapPin size={20} />, label: "Port Systems" },
                    ].map((s, i) => (
                        <div key={i} className="landing-stream-chip">
                            {s.icon}
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                FEATURES GRID
            ═══════════════════════════════════════════════════ */}
            <section id="features" className="landing-section">
                <div className="landing-section__inner">
                    <div className="landing-section__header">
                        <span className="landing-section__tag">System Views</span>
                        <h2 className="landing-section__title">Integrated Capabilities</h2>
                        <p className="landing-section__desc">Six operational modules working in unison to deliver complete situational awareness.</p>
                    </div>
                    <div className="landing-features-grid">
                        {features.map((f, i) => (
                            <div key={i} className="landing-feature-card">
                                <div className="landing-feature-card__icon">{f.icon}</div>
                                <h3 className="landing-feature-card__title">{f.title}</h3>
                                <p className="landing-feature-card__desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                ARCHITECTURE SECTION
            ═══════════════════════════════════════════════════ */}
            <section id="architecture" className="landing-section landing-section--dark">
                <div className="landing-section__inner">
                    <div className="landing-section__header">
                        <span className="landing-section__tag">Integration Core</span>
                        <h2 className="landing-section__title">System Architecture</h2>
                        <p className="landing-section__desc">A layered architecture designed for scalability, interoperability and continuous evolution.</p>
                    </div>

                    {/* Architecture Diagram — 3 Core Pillars */}
                    <div className="landing-arch-pillars">
                        <div className="landing-arch-pillar">
                            <div className="landing-arch-pillar__icon"><DbIcon size={28} /></div>
                            <h4>Data Integration</h4>
                            <ul>
                                <li>Multi-source Ingestion</li>
                                <li>Data Fusion</li>
                                <li>Real-time Processing</li>
                                <li>Consistent Context</li>
                            </ul>
                        </div>
                        <div className="landing-arch-pillar landing-arch-pillar--center">
                            <div className="landing-arch-pillar__icon landing-arch-pillar__icon--primary"><Cpu size={28} /></div>
                            <h4>Integration Core</h4>
                            <span className="landing-arch-pillar__sub">Data · Context · AI</span>
                        </div>
                        <div className="landing-arch-pillar">
                            <div className="landing-arch-pillar__icon"><BarChart3 size={28} /></div>
                            <h4>Operational Efficiency</h4>
                            <ul>
                                <li>Resource Optimization</li>
                                <li>Traffic Management</li>
                                <li>Predictive Analytics</li>
                                <li>Performance Monitoring</li>
                            </ul>
                        </div>
                    </div>

                    {/* System Layers */}
                    <div className="landing-layers">
                        <h3 className="landing-layers__title">System Layers</h3>
                        <div className="landing-layers__stack">
                            {systemLayers.map((l, i) => (
                                <div key={i} className="landing-layer" style={{ '--layer-color': l.color }}>
                                    <div className="landing-layer__dot" />
                                    <div>
                                        <strong>{l.label}</strong>
                                        <span>{l.desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                PRINCIPLES
            ═══════════════════════════════════════════════════ */}
            <section className="landing-section">
                <div className="landing-section__inner">
                    <div className="landing-section__header">
                        <span className="landing-section__tag">Philosophy</span>
                        <h2 className="landing-section__title">Core Principles</h2>
                    </div>
                    <div className="landing-principles">
                        {principles.map((p, i) => (
                            <div key={i} className="landing-principle">
                                <div className="landing-principle__icon">{p.icon}</div>
                                <h4>{p.title}</h4>
                                <p>{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                OUTPUTS / RESULTS BAR
            ═══════════════════════════════════════════════════ */}
            <section className="landing-outputs">
                <div className="landing-outputs__inner">
                    {["Situational Awareness", "Smart Decisions", "Optimized Operations", "Risk Mitigation", "Sustainable Harbors"].map((o, i) => (
                        <div key={i} className="landing-output-chip">{o}</div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════
                CONTACT + FOOTER
            ═══════════════════════════════════════════════════ */}
            <section id="contact" className="landing-section landing-section--dark landing-section--contact">
                <div className="landing-section__inner">
                    <div className="landing-contact">
                        <div className="landing-contact__info">
                            <span className="landing-section__tag">Get in Touch</span>
                            <h2 className="landing-section__title">Contact Us</h2>
                            <p className="landing-contact__desc">
                                Interested in deploying GeoKanban for your maritime operations?
                                Reach out for a demo or technical consultation.
                            </p>
                            <a href="mailto:giuseppe.berrelli@gmail.com" className="landing-contact__email">
                                <Mail size={18} />
                                giuseppe.berrelli@gmail.com
                            </a>
                        </div>
                        <div className="landing-contact__cta">
                            <button onClick={() => setShowLogin(true)} className="landing-btn landing-btn--primary landing-btn--lg">
                                Access Command Center <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="landing-footer__inner">
                    <div className="landing-footer__brand">
                        <Anchor size={20} />
                        <span>GeoKanban V3</span>
                    </div>
                    <p className="landing-footer__copy">
                        © {new Date().getFullYear()} Giusvelt · Precision Engineering
                    </p>
                    <p className="landing-footer__tagline">
                        One Platform. Connecting Data, Space and Operations for Smarter Harbors.
                    </p>
                </div>
            </footer>
        </div>
    );
}
