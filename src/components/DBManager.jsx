import React, { useState, useEffect } from 'react';
import { updateUserCustomOverrides, fetchTrackingPeriods, saveTrackingPeriods } from '../services/api/trackingService';
import * as XLSX from 'xlsx';
import {
    Ship, MapPin, Activity, Wrench, HeartPulse, Plus, Edit2, Trash2, X, Save,
    Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, FileDown, Upload,
    Building2, Globe, Mail, Phone, Map, Briefcase, FileText, Hash, Info, Anchor, Users,
    Wifi, Layers, Lock, Box
} from 'lucide-react';
import { parseGeofencesFromExcel } from '../utils/excelParser';
import { useFleet, useConfig } from '../context/DataContext';
import { useActivities } from '../hooks/useActivities';
import { useServices } from '../hooks/useServices';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { companiesService } from '../services/api/companiesService';
import { metricsService } from '../services/api/metricsService';
import SectionHeader from './SectionHeader';
import UserManagementTab from './UserManagementTab';
import { parsePart, parseCoordinateLine, toDDM, formatCoords } from '../utils/geoUtils';
import { DatabaseIcon } from './dbmanager/ModalField';
import {
    VesselsModalFields,
    CompaniesModalFields,
    GeofencesModalFields,
    ActivitiesModalFields,
    ServicesModalFields,
    StandbyModalFields,
} from './dbmanager/ModalContent';



const TABS = [
    { id: 'vessels', label: 'Vessels', icon: Ship, color: '#3b82f6' },
    { id: 'companies', label: 'Companies & Suppliers', icon: Building2, color: '#6366f1' },
    { id: 'geofences', label: 'Geofences', icon: MapPin, color: '#10b981' },
    { id: 'activities', label: 'Activities', icon: Activity, color: '#f59e0b' },
    { id: 'services', label: 'Nautical Services', icon: Wrench, color: '#8b5cf6' },
    { id: 'standby', label: 'Stand-by Reasons', icon: HeartPulse, color: '#f59e0b' },
    { id: 'users', label: 'User Management', icon: Users, color: '#ec4899' },

    { id: 'health', label: 'System Health', icon: HeartPulse, color: '#ef4444' },
];



export default function DBManager() {
    const { vessels, geofences, addVessel, updateVessel, deleteVessel, addGeofence, updateGeofence, deleteGeofence } = useFleet();
    const { standbyReasons, addStandbyReason, updateStandbyReason, deleteStandbyReason, profile } = useConfig();

    const { activityTypes, addActivityType, updateActivityType, deleteActivityType } = useActivities();
    const { services, addService, updateService, deleteService } = useServices();
    const { results: healthResults, running: healthRunning, runCheck } = useHealthCheck();

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [userStats, setUserStats] = useState({ total: 0, online: 0 });

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        try {
            const data = await companiesService.fetchAll();
            setCompanies(data);
        } catch (error) {
            console.error('Failed to fetch companies:', error);
        } finally {
            setCompaniesLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            const stats = await metricsService.fetchUserStats();
            setUserStats(stats);
        } catch (error) {
            console.error('Failed to fetch user stats:', error);
        }
    };

    const [activeTab, setActiveTab] = useState('vessels');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({});
    const [importing, setImporting] = useState(false);


    const [showGeofencesOnMap, setShowGeofencesOnMap] = useState(() => localStorage.getItem('gek_show_geofences') === 'true');


    const toggleGeofenceVisibility = async () => {
        const newVal = !showGeofencesOnMap;
        setShowGeofencesOnMap(newVal);
        localStorage.setItem('gek_show_geofences', newVal);
        window.dispatchEvent(new Event('geofences_visibility_changed'));

        if (profile && (profile.role === 'operation_admin' || profile.role === 'operation')) {
            const updatedOverrides = { ...(profile.custom_overrides || {}), global_show_geofences: newVal };
            await updateUserCustomOverrides(profile.id, updatedOverrides);
        }
    };

    const [trackingPeriods, setTrackingPeriods] = useState([]);
    const [loadingPeriods, setLoadingPeriods] = useState(false);

    useEffect(() => {
        if (showModal && activeTab === 'vessels' && editingItem?.id) {
            setLoadingPeriods(true);
            fetchTrackingPeriods(editingItem.id)
                .then(data => setTrackingPeriods(data))
                .catch(() => setTrackingPeriods([]))
                .finally(() => setLoadingPeriods(false));
        } else {
            setTrackingPeriods([]);
        }
    }, [showModal, activeTab, editingItem]);

    const handleAddPeriod = () => {
        setTrackingPeriods([
            ...trackingPeriods,
            {
                id: 'temp-' + Math.random().toString(36).substring(2, 9),
                vessel_id: editingItem?.id || '',
                start_date: new Date().toISOString().split('T')[0],
                end_date: null
            }
        ]);
    };

    const handlePeriodChange = (id, field, value) => {
        setTrackingPeriods(trackingPeriods.map(p => 
            p.id === id ? { ...p, [field]: value || null } : p
        ));
    };

    const handleDeletePeriod = (id) => {
        setTrackingPeriods(trackingPeriods.filter(p => p.id !== id));
    };

    const handleSaveTrackingPeriods = async (vId) => {
        await saveTrackingPeriods(vId, trackingPeriods);
    };



    useEffect(() => {
        fetchCompanies();
        fetchUserStats();
    }, []);

    const fileInputRef = React.useRef(null);
    const modalFileInputRef = React.useRef(null);
    const [coordFormat, setCoordFormat] = useState('DD'); // 'DD' | 'DDM'
    const [coordText, setCoordText] = useState('');

    const handleFormatChange = (newFormat) => {
        setCoordFormat(newFormat);
        if (coordText) {
            const lines = coordText.split('\n').filter(l => l.trim());
            const parsed = lines.map(line => parseCoordinateLine(line)).filter(Boolean);
            if (parsed.length > 0) {
                setCoordText(formatCoords(parsed, newFormat));
            }
        }
    };

    const getData = () => {
        let data = [];
        switch (activeTab) {
            case 'vessels': data = vessels || []; break;
            case 'companies': data = companies || []; break;
            case 'geofences': data = geofences || []; break;
            case 'activities': data = activityTypes || []; break;
            case 'services': data = services || []; break;
            case 'standby': data = standbyReasons || []; break;
        }
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter(item => {
            const name = (item.name || item.full_name || '').toLowerCase();
            const code = (item.code || item.mmsi || item.vat_number || '').toLowerCase();
            return name.includes(q) || code.includes(q);
        });
    };

    const handleAdd = () => {
        setEditingItem(null);
        setForm({});
        setCoordText('');
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setForm({ ...item });
        if (activeTab === 'geofences') {
            let coords = [];
            try {
                coords = typeof item.polygon_coords === 'string'
                    ? JSON.parse(item.polygon_coords)
                    : (item.polygon_coords || []);
            } catch (e) {
                console.error("Error parsing polygon_coords:", e);
            }
            if (Array.isArray(coords)) {
                setCoordText(formatCoords(coords, coordFormat));
            } else {
                setCoordText('');
            }
        } else {
            setCoordText('');
        }
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        let result = { success: true };
        switch (activeTab) {
            case 'vessels': result = await deleteVessel(id); break;
            case 'companies': 
                try {
                    await companiesService.delete(id);
                    fetchCompanies();
                    result = { success: true };
                } catch (error) {
                    result = { success: false, error: error?.message };
                }
                break;
            case 'geofences': result = await deleteGeofence(id); break;
            case 'activities': result = await deleteActivityType(id); break;
            case 'services': result = await deleteService(id); break;
            case 'standby': result = await deleteStandbyReason(id); break;
        }
        if (result && !result.success) alert('Error: ' + result.error);
    };

    const handleSave = async () => {
        let result;
        let payload = { ...form };

        if (activeTab === 'vessels') {
            if (!payload.mmsi || !payload.name) {
                alert('MMSI and Vessel Name are required.');
                return;
            }
        }

        if (activeTab === 'geofences') {
            if (!coordText || !coordText.trim()) {
                alert('Please enter coordinates for the geofence.');
                return;
            }
            const lines = coordText.split('\n').filter(l => l.trim());
            const coords = lines.map(line => parseCoordinateLine(line)).filter(Boolean);
            if (coords.length < 3) {
                alert('Error: A geofence requires at least 3 valid vertices to form a polygon. Please check the coordinate format.');
                return;
            }

            // Calculate centroid automatically as the average of the coordinates
            const latSum = coords.reduce((sum, c) => sum + c[0], 0);
            const lonSum = coords.reduce((sum, c) => sum + c[1], 0);
            const centroidLat = latSum / coords.length;
            const centroidLon = lonSum / coords.length;

            payload.lat = centroidLat;
            payload.lon = centroidLon;
            payload.polygon_coords = JSON.stringify(coords);
        }

        if (editingItem) {
            switch (activeTab) {
                case 'vessels': 
                    result = await updateVessel(editingItem.id, payload); 
                    if (result.success) {
                        await handleSaveTrackingPeriods(editingItem.id);
                    }
                    break;
                case 'companies':
                    try {
                        await companiesService.update(editingItem.id, payload);
                        fetchCompanies();
                        result = { success: true };
                    } catch (uErr) {
                        result = { success: false, error: uErr?.message };
                    }
                    break;
                case 'geofences': result = await updateGeofence(editingItem.id, payload); break;
                case 'activities': result = await updateActivityType(editingItem.id, payload); break;
                case 'services': result = await updateService(editingItem.id, payload); break;
                case 'standby': result = await updateStandbyReason(editingItem.id, payload); break;
            }
        } else {
            switch (activeTab) {
                case 'vessels': 
                    result = await addVessel(payload); 
                    if (result.success && result.data?.id) {
                        await handleSaveTrackingPeriods(result.data.id);
                    }
                    break;
                case 'companies':
                    try {
                        await companiesService.insert(payload);
                        fetchCompanies();
                        result = { success: true };
                    } catch (iErr) {
                        result = { success: false, error: iErr?.message };
                    }
                    break;
                case 'geofences': result = await addGeofence(payload); break;
                case 'activities': result = await addActivityType(payload); break;
                case 'services': result = await addService(payload); break;
                case 'standby': result = await addStandbyReason(payload); break;
            }
        }
        if (result && !result.success) { alert('Error: ' + result.error); return; }
        setShowModal(false);
    };

    const handleModalImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        try {
            const parsedGeofences = await parseGeofencesFromExcel(file);
            if (parsedGeofences.length === 1) {
                const geo = parsedGeofences[0];
                setForm({
                    ...form,
                    name: geo.name,
                    nature: geo.nature,
                    family: geo.family,
                    color: geo.color
                });
                
                let coords = [];
                try {
                    coords = typeof geo.polygon_coords === 'string'
                        ? JSON.parse(geo.polygon_coords)
                        : (geo.polygon_coords || []);
                } catch (err) {
                    coords = [];
                }
                setCoordText(formatCoords(coords, coordFormat));
                alert(`Geofence "${geo.name}" loaded into the form. Please review the fields and coordinates, then click save.`);
            } else if (parsedGeofences.length > 1) {
                let importedCount = 0;
                for (const newGeo of parsedGeofences) {
                    const res = await addGeofence(newGeo);
                    if (res.success) importedCount++;
                }
                alert(`Successfully imported ${importedCount} geofences in bulk.`);
                setShowModal(false);
            }
            if (modalFileInputRef.current) modalFileInputRef.current.value = "";
        } catch (err) {
            console.error("Modal import failed:", err);
            alert("Import failed: " + err.message);
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadGeofence = (geofence) => {
        let coords = [];
        try {
            coords = typeof geofence.polygon_coords === 'string'
                ? JSON.parse(geofence.polygon_coords)
                : geofence.polygon_coords;
        } catch (e) {
            console.error("Errore nel parsing del poligono:", e);
        }

        if (!Array.isArray(coords) || coords.length === 0) {
            alert("Errore: la geofence non ha vertici validi.");
            return;
        }

        // Crea i record per ciascun vertice conformi al template Excel
        const rows = coords.map(([lat, lon], index) => ({
            Name: geofence.name,
            Latitude: lat,
            Longitude: lon,
            Nature: geofence.nature || 'general',
            Family: geofence.family || '',
            Color: geofence.color || '#3b82f6',
            Vertex: index + 1
        }));

        // Genera il foglio di calcolo tramite XLSX
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Geofence");

        // Salva il file XLSX
        const fileName = `${geofence.name.replace(/\s+/g, '_')}_geofence.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const data = getData();
    const currentTab = TABS.find(t => t.id === activeTab);

    return (
        <div className="dbm-container">
            <SectionHeader 
                title="Database Manager" 
                subtitle="Master data synchronization and system integrity" 
                icon={DatabaseIcon}
                onRefresh={activeTab === 'companies' ? fetchCompanies : null}
                loading={companiesLoading}
            />

            {/* Tab Bar */}
            <div className="dbm-tabs bg-white/50 backdrop-blur-md rounded-[2.5rem] p-2 mb-8 border border-white flex flex-wrap gap-1 shadow-sm">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeTab === tab.id 
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                                : 'text-on-surface/40 hover:text-on-surface hover:bg-white/80'
                            }
                        `}
                        onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-surface-low/30'}`}>
                            {
                                tab.id === 'vessels' ? (vessels?.length || 0) :
                                tab.id === 'companies' ? (companies?.length || 0) :
                                tab.id === 'geofences' ? (geofences?.length || 0) :
                                tab.id === 'activities' ? (activityTypes?.length || 0) :
                                tab.id === 'services' ? (services?.length || 0) :
                                tab.id === 'standby' ? (standbyReasons?.length || 0) :
                                tab.id === 'users' ? `${userStats.total} / ${userStats.online}` :

                                tab.id === 'health' ? (healthResults ? (healthResults.filter(r => r.status === 'fail').length > 0 ? '!' : 'OK') : '-') :
                                0
                            }
                        </span>
                    </button>
                ))}
            </div>

            {/* User Management Tab Integration */}
            {activeTab === 'users' && <UserManagementTab />}


            {/* Health Check Panel */}
            {activeTab === 'health' && (
                <div className="mt-6 space-y-6">
                    {/* Header Dashboard */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/50 backdrop-blur-md rounded-[2.5rem] p-6 border border-white shadow-sm">
                        <div>
                            <h3 className="text-xl font-manrope font-extrabold text-on-surface uppercase tracking-tight">Operational Diagnostics</h3>
                            <p className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest mt-1">Real-time infrastructure & data pipeline health monitoring</p>
                        </div>
                        <button
                            className="bg-primary text-white px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-3 hover:scale-105 transition-all"
                            onClick={runCheck}
                            disabled={healthRunning}
                        >
                            <RefreshCw size={16} className={healthRunning ? 'animate-spin' : ''} />
                            {healthRunning ? 'Analyzing Pipeline...' : 'Run Full Diagnostics'}
                        </button>
                    </div>

                    {healthResults ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {healthResults.map((check, i) => {
                                const isFail = check.status === 'fail';
                                const isWarn = check.status === 'warn';
                                return (
                                    <div key={i} className={`bg-white rounded-[2rem] p-6 border border-white shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
                                        {/* Status Indicator Bar */}
                                        <div className={`absolute top-0 left-0 w-full h-1.5 ${isFail ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-green-500'}`} />
                                        
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFail ? 'bg-red-50 text-red-500' : isWarn ? 'bg-amber-50 text-amber-500' : 'bg-green-50 text-green-500'}`}>
                                                {check.name.includes('AIS') ? <Wifi size={20} /> : 
                                                 check.name.includes('KPI') ? <Activity size={20} /> :
                                                 check.name.includes('Operational') ? <Layers size={20} /> :
                                                 check.name.includes('Fleet') ? <Anchor size={20} /> :
                                                 check.name.includes('Security') ? <Lock size={20} /> :
                                                 <CheckCircle size={20} />}
                                            </div>
                                            <div className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${isFail ? 'bg-red-100 text-red-700' : isWarn ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                {check.status.toUpperCase()}
                                            </div>
                                        </div>

                                        <h4 className="text-xs font-black text-on-surface uppercase tracking-widest mb-1">{check.name}</h4>
                                        <p className="text-[11px] font-bold text-on-surface/50 leading-relaxed min-h-[3em]">{check.detail}</p>
                                        
                                        <div className="mt-4 pt-4 border-t border-surface-low/30 flex items-center justify-between">
                                            <span className="text-[8px] font-black text-on-surface/20 uppercase tracking-widest">Diagnostics Pass</span>
                                            <div className={`w-2 h-2 rounded-full ${isFail ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white/50 backdrop-blur-md rounded-[3rem] p-20 text-center border border-white shadow-sm">
                             <HeartPulse size={48} className="mx-auto text-on-surface/10 mb-6" />
                             <h3 className="text-sm font-black text-on-surface/30 uppercase tracking-[0.2em]">Ready for Health Check</h3>
                             <p className="text-[10px] font-bold text-on-surface/20 mt-2">Initialize diagnostic protocols to verify system integrity</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab !== 'health' && activeTab !== 'users' && (
                <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 lg:p-6 border border-white shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-surface-low/30 shadow-inner w-full md:max-w-xs">
                            <Search size={14} className="text-on-surface/20" />
                            <input
                                type="text"
                                placeholder={`Search ${currentTab?.label}...`}
                                className="bg-transparent border-none outline-none text-[10px] font-bold text-on-surface w-full placeholder:text-on-surface/20"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab === 'geofences' && (
                                <div className="flex items-center gap-2 mr-4 bg-white px-4 py-2 rounded-full border border-surface-low/30 shadow-sm">
                                    <span className="text-[10px] font-black uppercase text-on-surface/50">Show on Map</span>
                                    <button 
                                        onClick={toggleGeofenceVisibility}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${showGeofencesOnMap ? 'bg-primary' : 'bg-surface-low/50'}`}
                                    >
                                        <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${showGeofencesOnMap ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            )}
                            <button className="bg-primary text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all" onClick={handleAdd}>
                                <Plus size={14} /> Add {currentTab?.label.replace(/s$/, '').split(' ')[0]}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                                    <th className="px-4 py-3">#</th>
                                    {activeTab === 'companies' && (
                                        <>
                                            <th className="px-4 py-3">Company</th>
                                            <th className="px-4 py-3">VAT / P.IVA</th>
                                            <th className="px-4 py-3">Location</th>
                                            <th className="px-4 py-3">Type</th>
                                        </>
                                    )}
                                    {activeTab === 'vessels' && (
                                        <>
                                            <th className="px-4 py-3">Vessel Name</th>
                                            <th className="px-4 py-3">MMSI</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Gross Tonnage (GT)</th>
                                            <th className="px-4 py-3">Company</th>
                                        </>
                                    )}
                                    {activeTab === 'geofences' && (
                                        <>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Nature</th>
                                            <th className="px-4 py-3">Family</th>
                                            <th className="px-4 py-3">Color</th>
                                            <th className="px-4 py-3 text-center">Vertices</th>
                                        </>
                                    )}
                                    {activeTab === 'activities' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Activity</th>
                                            <th className="px-4 py-3">Category</th>
                                            <th className="px-4 py-3">Description</th>
                                        </>
                                    )}
                                    {activeTab === 'services' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Service</th>
                                            <th className="px-4 py-3">Provider</th>
                                        </>
                                    )}
                                    {activeTab === 'standby' && (
                                        <>
                                            <th className="px-4 py-3">Code</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Description</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr><td colSpan={10} className="dbm-empty p-8 text-center text-on-surface/20 font-bold">No {currentTab?.label.toLowerCase()} found</td></tr>
                                ) : data.map((item, i) => (
                                    <tr key={item.id} className="group">
                                        <td className="px-4 py-2 bg-white rounded-l-xl text-[9px] font-black text-on-surface/10">{i + 1}</td>
                                        
                                        {activeTab === 'vessels' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 font-mono">{item.mmsi}</td>
                                                <td className="px-4 py-2 bg-white text-[9px] font-black text-on-surface/20 uppercase italic">{item.vessel_type}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-extrabold text-on-surface/60 font-mono">{item.gross_tonnage ? `${item.gross_tonnage} GT` : '—'}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-primary truncate max-w-[120px]">{companies?.find(c => c.id === item.company_id)?.name || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'companies' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 uppercase font-mono">{item.vat_number || '—'}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.city || '—'}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <div className="flex gap-1">
                                                        {item.is_shipowner && <span className="text-[7px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">Owner</span>}
                                                        {item.is_supplier && <span className="text-[7px] font-black uppercase bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Supplier</span>}
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'geofences' && (
                                            <>
                                                <td className="px-4 py-2 bg-white font-manrope font-extrabold text-xs text-on-surface truncate max-w-[200px]">{item.name}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full border border-current/10" style={{ color: item.color, background: `${item.color}10` }}>
                                                        {item.nature?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.family || '—'}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <div className="flex items-center gap-2 text-[9px] font-black opacity-30">
                                                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                                                        {item.color}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-center text-[10px] font-bold text-on-surface/20">
                                                    {(() => {
                                                        const p = typeof item.polygon_coords === 'string' ? JSON.parse(item.polygon_coords) : item.polygon_coords;
                                                        return Array.isArray(p) ? p.length : '—';
                                                    })()}
                                                </td>
                                            </>
                                        )}
                                        {activeTab === 'activities' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-primary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                <td className="px-4 py-2 bg-white">
                                                    <span className="text-[8px] font-black uppercase bg-surface-low/30 px-2 py-0.5 rounded-full text-on-surface/40">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/40 italic">{item.description || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'services' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.provider || '—'}</td>
                                            </>
                                        )}
                                        {activeTab === 'standby' && (
                                            <>
                                                <td className="px-4 py-2 bg-white text-[10px] font-black text-secondary">{item.code}</td>
                                                <td className="px-4 py-2 bg-white font-extrabold text-xs uppercase tracking-tight">{item.name}</td>
                                                 <td className="px-4 py-2 bg-white text-[10px] font-bold text-on-surface/60">{item.description || '—'}</td>
                                            </>
                                        )}
                                        <td className="px-4 py-2 bg-white rounded-r-xl text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {activeTab === 'geofences' && (
                                                    <button 
                                                        onClick={() => handleDownloadGeofence(item)} 
                                                        className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-indigo-600 hover:text-white transition-all"
                                                        title="Download Geofence (.xlsx)"
                                                    >
                                                        <FileDown size={12} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEdit(item)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-primary hover:text-white transition-all">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="w-6 h-6 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/20 hover:bg-red-500 hover:text-white transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Premium Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-surface-low/30 flex items-center justify-between bg-gradient-to-r from-surface-low/20 to-transparent">
                            <div>
                                <h3 className="text-lg font-manrope font-black text-on-surface uppercase tracking-tight">
                                    {editingItem ? 'Edit' : 'Create'} {currentTab?.label.replace(/s$/, '').split(' ')[0]}
                                </h3>
                                <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mt-1">Master Data Registry Entry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/40 hover:bg-white transition-all shadow-sm">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-2 gap-4 custom-scrollbar">
                            {activeTab === 'vessels' && (
                                <VesselsModalFields
                                    form={form} setForm={setForm}
                                    geofences={geofences} companies={companies}
                                    trackingPeriods={trackingPeriods} loadingPeriods={loadingPeriods}
                                    handleAddPeriod={handleAddPeriod}
                                    handleDeletePeriod={handleDeletePeriod}
                                    handlePeriodChange={handlePeriodChange}
                                />
                            )}
                            {activeTab === 'companies' && (
                                <CompaniesModalFields form={form} setForm={setForm} />
                            )}
                            {activeTab === 'geofences' && (
                                <GeofencesModalFields
                                    form={form} setForm={setForm}
                                    coordFormat={coordFormat} coordText={coordText} setCoordText={setCoordText}
                                    handleFormatChange={handleFormatChange}
                                    handleModalImportExcel={handleModalImportExcel}
                                    modalFileInputRef={modalFileInputRef}
                                    importing={importing}
                                />
                            )}
                            {activeTab === 'activities' && (
                                <ActivitiesModalFields form={form} setForm={setForm} />
                            )}
                            {activeTab === 'services' && (
                                <ServicesModalFields form={form} setForm={setForm} />
                            )}
                            {activeTab === 'standby' && (
                                <StandbyModalFields form={form} setForm={setForm} />
                            )}
                        </div>

                        <div className="p-6 bg-surface-low/20 border-t border-surface-low/30 flex items-center justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest hover:bg-white transition-all">Cancel</button>
                            <button onClick={handleSave} className="bg-primary text-white px-8 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all">
                                <Save size={14} /> {editingItem ? 'Update' : 'Register'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
