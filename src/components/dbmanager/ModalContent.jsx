/**
 * ModalContent.jsx — Tab-specific modal form fields for DBManager.
 * Extracted from DBManager.jsx (lines 717-980) to reduce file length.
 * DBManager owns all state (form, setForm) and passes it down via props.
 */

import React from 'react';
import { ModalField } from './ModalField';
import {
    Ship, MapPin, Activity, Wrench, HeartPulse, Plus, Trash2,
    Building2, Globe, Mail, Phone, Map, Briefcase, FileText,
    Hash, Info, Anchor, RefreshCw, FileDown, Upload, Box
} from 'lucide-react';

// ─── D3: Vessels ────────────────────────────────────────────────────────────

export function VesselsModalFields({
    form, setForm,
    geofences, companies,
    trackingPeriods, loadingPeriods,
    handleAddPeriod, handleDeletePeriod, handlePeriodChange,
}) {
    return (
        <>
            <ModalField label="MMSI *" value={form.mmsi} onChange={v => setForm({...form, mmsi: v})} icon={Hash} />
            <ModalField label="Vessel Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Ship} />
            <ModalField label="IMO" value={form.imo} onChange={v => setForm({...form, imo: v})} icon={Info} />
            <ModalField label="Type" value={form.vessel_type} onChange={v => setForm({...form, vessel_type: v})} icon={Anchor} />
            <ModalField label="Avg Cargo (tons)" value={form.avg_cargo} onChange={v => setForm({...form, avg_cargo: Number(v)})} icon={Box} type="number" />
            <ModalField label="Cycle (hours)" value={form.standard_cycle_hours} onChange={v => setForm({...form, standard_cycle_hours: Number(v)})} icon={RefreshCw} type="number" />
            <ModalField label="Gross Tonnage (GT)" value={form.gross_tonnage} onChange={v => setForm({...form, gross_tonnage: v ? Number(v) : null})} icon={Info} type="number" />

            <div className="col-span-2 flex items-center gap-6 p-3 bg-surface-low/10 rounded-xl border border-surface-low/20">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-surface-low/50 text-primary focus:ring-primary/20"
                        checked={form.is_free_route || false}
                        onChange={e => setForm({...form, is_free_route: e.target.checked, preferred_loading_site_id: e.target.checked ? null : form.preferred_loading_site_id})}
                    />
                    <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Free Route (Zeta Vessels)</span>
                </label>
            </div>

            {!form.is_free_route && (
                <div className="col-span-2">
                    <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-2 px-1">Preferred Loading Site</label>
                    <select
                        className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none bg-white"
                        value={form.preferred_loading_site_id || ''}
                        onChange={e => setForm({...form, preferred_loading_site_id: e.target.value || null})}
                    >
                        <option value="">None / Standard Lookup</option>
                        {(geofences || []).filter(g => g.nature === 'loading_site' || g.nature === 'base_port').map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="col-span-2">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-2 px-1">Owning Company (Armatore)</label>
                <select
                    className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none"
                    value={form.company_id || ''}
                    onChange={e => setForm({...form, company_id: e.target.value || null})}
                >
                    <option value="">Generic / Undefined</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Vessel Tracking Periods */}
            <div className="col-span-2 mt-0 pt-2 border-t border-surface-low/30">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Vessel Tracking Periods</h4>
                        <p className="text-[8px] font-bold text-on-surface/30 uppercase tracking-widest mt-0.5">Manage contract intervals and API ON/OFF switch</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddPeriod}
                        className="bg-primary/10 hover:bg-primary/20 text-primary text-[8.5px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
                    >
                        <Plus size={10} /> Add Period
                    </button>
                </div>

                {loadingPeriods ? (
                    <div className="text-[10px] font-bold text-on-surface/30 uppercase py-2 text-center">Loading periods...</div>
                ) : trackingPeriods.length === 0 ? (
                    <div className="bg-surface-low/10 border border-dashed border-surface-low/30 rounded-xl p-4 text-center text-[10px] font-bold text-on-surface/30 uppercase">
                        No periods registered. Vessel tracking will remain disabled (OFF).
                    </div>
                ) : (
                    <div className="space-y-2">
                        {trackingPeriods.map((period) => (
                            <div key={period.id} className="flex items-center gap-3 bg-surface-low/10 p-2.5 rounded-xl border border-surface-low/20 animate-in fade-in duration-200">
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[7.5px] font-black text-on-surface/30 uppercase tracking-widest block mb-1">Tracking Start *</label>
                                        <input
                                            type="date"
                                            required
                                            value={period.start_date ? period.start_date.split('T')[0] : ''}
                                            onChange={e => handlePeriodChange(period.id, 'start_date', e.target.value)}
                                            className="w-full bg-white border border-surface-low/30 rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[7.5px] font-black text-on-surface/30 uppercase tracking-widest block mb-1">Tracking End (Optional)</label>
                                        <input
                                            type="date"
                                            value={period.end_date ? period.end_date.split('T')[0] : ''}
                                            onChange={e => handlePeriodChange(period.id, 'end_date', e.target.value)}
                                            className="w-full bg-white border border-surface-low/30 rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all self-end shadow-sm"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

// ─── D4: Companies ───────────────────────────────────────────────────────────

export function CompaniesModalFields({ form, setForm }) {
    return (
        <>
            <div className="col-span-2">
                <ModalField label="Company Short Name (Public) *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Building2} />
            </div>
            <ModalField label="Full Business Name" value={form.full_name} onChange={v => setForm({...form, full_name: v})} icon={FileText} />
            <ModalField label="VAT Number (P.IVA)" value={form.vat_number} onChange={v => setForm({...form, vat_number: v})} icon={Hash} />

            <div className="col-span-2 mt-2 pt-2 border-t border-surface-low/30">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Location &amp; Contact</p>
            </div>
            <ModalField label="Address" value={form.address} onChange={v => setForm({...form, address: v})} icon={Map} />
            <div className="grid grid-cols-2 gap-3 col-span-1">
                <ModalField label="City" value={form.city} onChange={v => setForm({...form, city: v})} icon={Globe} />
                <ModalField label="ZIP" value={form.zip} onChange={v => setForm({...form, zip: v})} icon={Hash} />
            </div>
            <ModalField label="Email" value={form.email} onChange={v => setForm({...form, email: v})} icon={Mail} />
            <ModalField label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} icon={Phone} />

            <div className="col-span-2 flex items-center gap-6 mt-2 p-3 bg-surface-low/10 rounded-xl border border-surface-low/20">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-surface-low/50 text-primary focus:ring-primary/20" checked={form.is_shipowner || false} onChange={e => setForm({...form, is_shipowner: e.target.checked})} />
                    <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Shipowner</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-surface-low/50 text-secondary focus:ring-secondary/20" checked={form.is_supplier || false} onChange={e => setForm({...form, is_supplier: e.target.checked})} />
                    <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Supplier</span>
                </label>
            </div>
        </>
    );
}

// ─── D5: Geofences ───────────────────────────────────────────────────────────

export function GeofencesModalFields({
    form, setForm,
    coordFormat, coordText, setCoordText,
    handleFormatChange, handleModalImportExcel,
    modalFileInputRef, importing,
}) {
    return (
        <>
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={MapPin} />
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Nature *</label>
                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.nature || ''} onChange={e => setForm({ ...form, nature: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="loading_site">Loading Site</option>
                    <option value="unloading_site">Unloading Site</option>
                    <option value="base_port">Base Port</option>
                    <option value="anchorage">Anchorage</option>
                    <option value="transit">Transit</option>
                    <option value="mooring">Mooring</option>
                    <option value="port">Port</option>
                    <option value="rada">Rada</option>
                    <option value="general">General</option>
                </select>
            </div>
            <ModalField label="Family" value={form.family || ''} onChange={v => setForm({ ...form, family: v })} icon={Briefcase} />
            <ModalField label="Color" value={form.color || '#3b82f6'} onChange={v => setForm({ ...form, color: v })} icon={null} type="color" />

            {/* Format Selector and Excel Import Actions */}
            <div className="col-span-2 border-t border-surface-low/30 pt-4 mt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                    <div>
                        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block">Coordinate Format &amp; Source</label>
                        <p className="text-[8px] font-bold text-on-surface/30 uppercase tracking-widest mt-0.5">Specify vertex format or pre-fill form from Excel</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-surface-low/20 p-1 rounded-full border border-surface-low/30 shadow-inner">
                            <button type="button" className={`px-3 py-1.5 rounded-full text-[8.5px] font-black uppercase tracking-wider transition-all ${coordFormat === 'DD' ? 'bg-primary text-white shadow-sm' : 'text-on-surface/40 hover:text-on-surface'}`} onClick={() => handleFormatChange('DD')}>DD (Decimal)</button>
                            <button type="button" className={`px-3 py-1.5 rounded-full text-[8.5px] font-black uppercase tracking-wider transition-all ${coordFormat === 'DDM' ? 'bg-primary text-white shadow-sm' : 'text-on-surface/40 hover:text-on-surface'}`} onClick={() => handleFormatChange('DDM')}>DDM (Nautical)</button>
                        </div>
                        <input type="file" ref={modalFileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls" onChange={handleModalImportExcel} />
                        <button type="button" className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-surface-low/30 px-3 py-2 rounded-full text-[8.5px] font-black text-on-surface/40 uppercase tracking-widest transition-all" onClick={() => modalFileInputRef.current?.click()} disabled={importing}>
                            <Upload size={12} /> {importing ? 'Importing...' : 'Import Excel'}
                        </button>
                        <a href="/templates/geofence_import_template.xlsx" download className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-surface-low/30 px-3 py-2 rounded-full text-[8.5px] font-black text-on-surface/40 uppercase tracking-widest transition-all" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <FileDown size={12} /> Template
                        </a>
                    </div>
                </div>
            </div>

            {/* Coordinate Textarea */}
            <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block px-1">Vertices Coordinates * (one pair per line)</label>
                <textarea
                    rows={6}
                    className="w-full bg-surface-low/20 border-none rounded-2xl px-5 py-4 text-xs font-bold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all font-mono leading-relaxed resize-y placeholder:text-on-surface/10"
                    placeholder={coordFormat === 'DD'
                        ? "Esempio:\n42.90181272, 10.598014\n42.944044, 10.6198791\n42.94871658, 10.5696456\n(Accetta sia punto che virgola come decimali)"
                        : "Esempio:\n42° 54.108' N, 10° 35.880' E\n42° 56.643' N, 10° 37.193' E\n42° 56.923' N, 10° 34.179' E"
                    }
                    value={coordText}
                    onChange={e => setCoordText(e.target.value)}
                />
            </div>
        </>
    );
}

// ─── D6: Activities ──────────────────────────────────────────────────────────

export function ActivitiesModalFields({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code} onChange={v => setForm({...form, code: v.toUpperCase()})} icon={Hash} />
            <ModalField label="Activity Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Activity} />
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Category</label>
                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="navigation">Navigation</option>
                    <option value="mooring">Mooring</option>
                    <option value="cargo">Cargo</option>
                    <option value="supply">Supply</option>
                    <option value="maintenance">Maintenance</option>
                </select>
            </div>
            <ModalField label="Description" value={form.description} onChange={v => setForm({...form, description: v})} icon={FileText} />
        </>
    );
}

// ─── D7a: Nautical Services ──────────────────────────────────────────────────

export function ServicesModalFields({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={Wrench} />
            <ModalField label="Provider" value={form.provider || ''} onChange={v => setForm({ ...form, provider: v })} icon={Building2} />
        </>
    );
}

// ─── D7b: Stand-by Reasons ───────────────────────────────────────────────────

export function StandbyModalFields({ form, setForm }) {
    return (
        <>
            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={HeartPulse} />
            <ModalField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} icon={FileText} />
        </>
    );
}
