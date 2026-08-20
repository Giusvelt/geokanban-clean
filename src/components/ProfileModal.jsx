import React, { useState } from 'react';
import { User, LogOut, X, Ship, Activity, Mail, Edit2, Check, Building, Phone, ShieldCheck } from 'lucide-react';
import '../logbook-writer.css';

export default function ProfileModal({ profile, onClose, onSignOut, updateProfile }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(profile?.displayName || '');
    const [editedCompany, setEditedCompany] = useState(profile?.companyName || '');
    const [editedPhone, setEditedPhone] = useState(profile?.phoneNumber || '');
    const [editedSignatureTitle, setEditedSignatureTitle] = useState(profile?.signatureTitle || '');
    const [saving, setSaving] = useState(false);

    if (!profile) return null;

    // Get an initial for the avatar
    const initial = (profile.displayName || profile.email || '?').charAt(0).toUpperCase();

    const handleSave = async () => {
        if (!updateProfile) return;
        setSaving(true);
        await updateProfile({
            displayName: editedName,
            phoneNumber: editedPhone,
            signatureTitle: editedSignatureTitle
        });
        setSaving(false);
        setIsEditing(false);
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 9998, backgroundColor: 'transparent'
            }}
        >
            <div
                style={{
                    position: 'absolute', top: '70px', right: '20px', width: '320px',
                    background: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0', zIndex: 9999, overflow: 'hidden',
                    animation: 'slideInTop 0.2s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#475569', fontWeight: '600' }}>My Account</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isEditing && updateProfile && (
                            <button className="btn-close" onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Edit Profile">
                                <Edit2 size={16} />
                            </button>
                        )}
                        <button className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '24px 20px' }}>

                    {/* Big Avatar */}
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '28px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                    }}>
                        {initial}
                    </div>

                    {/* User Info */}
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedName}
                                onChange={e => setEditedName(e.target.value)}
                                placeholder="Full Name"
                                style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', marginBottom: '8px', fontSize: '16px' }}
                            />
                        ) : (
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#1e293b' }}>
                                {profile.displayName || 'Unknown User'}
                            </h3>
                        )}
                        <span style={{
                            display: 'inline-block', padding: '4px 10px', borderRadius: '12px',
                            background: profile.role === 'admin' ? '#fef2f2' : '#f0fdf4',
                            color: profile.role === 'admin' ? '#ef4444' : '#10b981',
                            fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {profile.role}
                        </span>
                    </div>

                    <div style={{ width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {isEditing ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                    <Building size={16} />
                                    <input
                                        type="text" value={editedCompany} onChange={e => setEditedCompany(e.target.value)}
                                        placeholder="Company / Armatore"
                                        style={{ flex: 1, padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                    <Phone size={16} />
                                    <input
                                        type="text" value={editedPhone} onChange={e => setEditedPhone(e.target.value)}
                                        placeholder="Phone Number"
                                        style={{ flex: 1, padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                    <ShieldCheck size={16} className="text-primary" />
                                    <input
                                        type="text" value={editedSignatureTitle} onChange={e => setEditedSignatureTitle(e.target.value)}
                                        placeholder="Signature Title / Responsibility"
                                        style={{ flex: 1, padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {(profile.companyName) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                        <Building size={16} />
                                        <span>{profile.companyName}</span>
                                    </div>
                                )}
                                {(profile.phoneNumber) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                        <Phone size={16} />
                                        <span>{profile.phoneNumber}</span>
                                    </div>
                                )}
                                {(profile.signatureTitle) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#3b82f6', fontSize: '14px', fontWeight: 'bold' }}>
                                        <ShieldCheck size={16} />
                                        <span>Title: {profile.signatureTitle}</span>
                                    </div>
                                )}
                            </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                            <Mail size={16} />
                            <span>{profile.email}</span>
                        </div>

                        {(profile.vesselName || profile.vesselId) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#475569', fontSize: '14px' }}>
                                <Ship size={16} />
                                <span>Assigned to: <strong>{profile.vesselName || 'Unknown Vessel'}</strong></span>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#10b981', fontSize: '14px' }}>
                            <Activity size={16} />
                            <span>Status: {profile.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>

                    <div style={{ width: '100%', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isEditing && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', padding: '10px', background: '#10b981', color: 'white',
                                    border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Check size={16} />
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                        )}
                        <button
                            onClick={onSignOut}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', padding: '10px', background: '#fee2e2', color: '#ef4444',
                                border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#fecaca'}
                            onMouseOut={(e) => e.target.style.background = '#fee2e2'}
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
