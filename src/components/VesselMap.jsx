import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Maximize2, Waves, Wind, ArrowUp } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useUserProfile } from '../hooks/useUserProfile';
import { can } from '../lib/permissions';
import { fetchAdminCustomOverrides, subscribeToAdminProfileChanges } from '../services/api/trackingService';
import { weatherService } from '../services/api/weatherService';
import { useFleet } from '../context/DataContext';

// Palette colori fissa per le navi (max 12 colori, sincronizzata con StandbySchedule)
const VESSEL_COLORS = [
    '#06b6d4', // cyan-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#f43f5e', // rose-500
    '#f59e0b', // amber-500
    '#0ea5e9', // sky-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#6366f1', // indigo-500
    '#a855f7', // purple-500
];

// Custom vessel icon builder
const createVesselIcon = (heading = 0, isMoving = false, isStale = false, customColor = '#3b82f6', isOffHire = false) => {
    // Colore stabile della nave dalla legenda. Se il dato è vecchio (>12h), usiamo Arancio Scuro come fallback.
    const baseColor = isStale ? '#d84315' : customColor;

    // Dimensioni: 18px per tutte le navi come richiesto
    const size = 18;
    
    // Riempimento: sempre il colore della legenda, come richiesto
    const fillColor = baseColor;

    // Contorno: rosso da 0.5px se Off Hire, altrimenti colore della legenda
    let strokeColor = baseColor;
    let strokeWidth = isMoving ? 3.0 : 1.5;

    if (isOffHire) {
        strokeColor = '#ef4444';
        strokeWidth = 2.0;
    }

    // Default heading a 0 se non definito o nullo
    const rotation = heading !== null && heading !== undefined ? heading : 0;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" style="transform: rotate(${rotation}deg); transform-origin: center; display: block;">
        <path d="M12 2 L8 20 L12 17 L16 20 Z"/>
    </svg>`;

    const anchor = size / 2;

    return L.divIcon({
        html: svg,
        className: '',
        iconSize: [size, size],
        iconAnchor: [anchor, anchor]
    });
};

// Geofence nature → color
const geoColor = (nature) => {
    const map = {
        'loading_site': '#10b981',
        'unloading_site': '#f59e0b',
        'anchorage': '#8b5cf6',
        'port': '#3b82f6',
        'rada': '#6366f1',
        'mooring': '#06b6d4'
    };
    return map[nature?.toLowerCase()] || '#64748b';
};

// Convert wind degrees to cardinal direction string
const getWindDirectionCardinal = (deg) => {
    if (deg === null || deg === undefined) return '';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return `${Math.round(deg)}° ${directions[index]}`;
};

export default function VesselMap({ geofences = [], vesselPositions = [], height = '100%', offHireVessels = {} }) {
    const { profile } = useUserProfile();
    const perms = profile?.permissions || can(profile?.role);
    const forceShowGeofences = perms.isOperationAdmin;

    const [showGeofences, setShowGeofences] = useState(() => localStorage.getItem('gek_show_geofences') === 'true');
    const [globalShowGeofences, setGlobalShowGeofences] = useState(true);

    useEffect(() => {
        const handleGeofencesToggled = () => {
            setShowGeofences(localStorage.getItem('gek_show_geofences') === 'true');
        };
        window.addEventListener('geofences_visibility_changed', handleGeofencesToggled);

        // Fetch initial global geofence visibility from admin profile
        fetchAdminCustomOverrides().then(overrides => {
            if (overrides) setGlobalShowGeofences(overrides.global_show_geofences !== false);
        });

        // Subscribe to realtime changes on admin profiles
        const channel = subscribeToAdminProfileChanges((payload) => {
            if (payload.new.role === 'operation_admin' || payload.new.role === 'operation') {
                const newOverrides = payload.new.custom_overrides || {};
                setGlobalShowGeofences(newOverrides.global_show_geofences !== false);
            }
        });

        return () => {
            window.removeEventListener('geofences_visibility_changed', handleGeofencesToggled);
            if (channel) channel.unsubscribe();
        };
    }, []);

    const { vessels: dbVessels } = useFleet();
    const [meteo, setMeteo] = useState(null);

    // Palette colori fissa mappata per nome nave
    const VESSEL_COLOR_MAPPING = {
        'SIDER BUFFALO': '#00FFFF', // Ciano brillante
        'SIDER ORION': '#00FF00',   // Verde fluo
        'SIDER RODI': '#FF6600',    // Arancio
        'ANNAMARIA Z': '#FF00FF',   // Fucsia / Magenta
        'FABIO DUO Z': '#FFFF00',   // Giallo acceso
        'MARIA VITTORIA Z': '#1D4ED8', // Blu primario / Oltremare
        'SIDER ABIDJAN': '#FF0000', // Rosso vivo
        'SIDER DONUT': '#6366F1',   // Blu-Viola
        'SIDER REBECCA': '#FFFFFF', // Bianco
    };

    // Mappa vessel_id → colore stabile sincronizzato
    const vesselColorMap = useMemo(() => {
        const map = {};
        const activeVesselsList = (dbVessels || []).filter(v => v.tracking_active);
        activeVesselsList.forEach((v) => {
            map[v.id] = VESSEL_COLOR_MAPPING[v.name?.toUpperCase()] || '#94a3b8';
        });
        return map;
    }, [dbVessels]);

    useEffect(() => {
        async function fetchLatestMeteo() {
            try {
                const data = await weatherService.fetchLatestMeteoOverlay();
                if (data) setMeteo(data);
            } catch (err) {
                console.error("Error fetching Scanno Diga live meteo overlay:", err);
            }
        }

        fetchLatestMeteo();
        const interval = setInterval(fetchLatestMeteo, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Parse polygon coords safely
    const parsedGeofences = useMemo(() => {
        return geofences.map(g => {
            try {
                const coords = typeof g.polygon_coords === 'string'
                    ? JSON.parse(g.polygon_coords)
                    : g.polygon_coords;
                if (Array.isArray(coords) && coords.length >= 3) {
                    return { ...g, parsedCoords: coords };
                }
            } catch { /* skip malformed */ }
            return null;
        }).filter(Boolean);
    }, [geofences]);

    // Valid vessel positions only - Simple check
    const validPositions = (vesselPositions || []).filter(p => p && p.lat && p.lon);

    // Force map resize fix
    const InvalidateMap = () => {
        const map = useMap();
        React.useEffect(() => {
            const timer = setTimeout(() => map.invalidateSize(), 800);
            return () => clearTimeout(timer);
        }, [map]);
        return null;
    };

    // Monitor map zoom and interaction
    const MapEvents = () => {
        const { set3DActive, setFocusCoords } = useUIStore();
        const map = useMapEvents({
            zoomend: () => {
                const zoom = map.getZoom();
                // Se lo zoom è estremo (>18), potremmo suggerire il 3D
            }
        });
        return null;
    };

    // Set center fixed to Genova area
    const center = [44.0, 9.0];
    const effectiveShowGeofences = forceShowGeofences || (showGeofences && globalShowGeofences);

    return (
        <div style={{ position: 'relative', height, width: '100%' }}>
            <MapContainer
                center={center}
                zoom={8}
                style={{ height: '100%', width: '100%', borderRadius: '16px' }}
                zoomControl={false}
                className="map-tiles-contrast"
            >
                <InvalidateMap />
                <MapEvents />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CartoDB'
                />



                {/* Geofence polygons */}
                {effectiveShowGeofences && parsedGeofences.map(g => (
                    <Polygon
                        key={g.id}
                        positions={g.parsedCoords}
                        pathOptions={{
                            color: g.color || geoColor(g.nature),
                            fillColor: g.color || geoColor(g.nature),
                            fillOpacity: 0.15,
                            weight: 1
                        }}
                    >
                        <Popup>
                            <strong>{g.name}</strong><br />
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {g.nature || 'General'}
                            </span>
                        </Popup>
                    </Polygon>
                ))}

                {validPositions.map(pos => {
                    const vId = pos.vesselId || pos.vessel_id;
                    const customColor = vesselColorMap[vId] || '#3b82f6';
                    // Usa heading, ma se è 0, assente o 511 (non valido), usa course (COG)
                    const effectiveHeading = (pos.heading && pos.heading !== 511 && pos.heading !== 0) ? pos.heading : (pos.course || pos.cog || 0);
                    
                    const isMoored = pos.status?.toLowerCase().includes('moored') || pos.status?.toLowerCase().includes('anchor');
                    const effectiveSpeed = isMoored ? 0 : (pos.speed || 0);
                    const isMoving = effectiveSpeed > 0.8;
                    const isOffHire = !!offHireVessels[vId];

                    return (
                        <Marker
                            key={pos.vessel}
                            position={[pos.lat, pos.lon]}
                            icon={createVesselIcon(effectiveHeading, isMoving, pos.isStale, customColor, isOffHire)}
                        >
                            <Popup>
                                <strong>{pos.vessel}</strong><br />
                                <span style={{ fontSize: '11px' }}>
                                    Speed: {effectiveSpeed.toFixed(1)} kn<br />
                                    Status: {pos.status}<br />
                                Last Update: {pos.timestamp || pos.lastUpdate ? new Date(pos.timestamp || pos.lastUpdate).toLocaleString() : '—'}<br />
                                {pos.isStale && <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>● Offline ({'>'}12h)</span>}
                                </span>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Overlay Meteo Cantiere */}
            <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/80 backdrop-blur-md rounded-2xl p-3 border border-slate-800 shadow-xl font-manrope min-w-[140px] pointer-events-auto flex flex-col gap-2">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Meteo Cantiere</div>
                {meteo ? (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                            <Wind size={11} className="text-amber-500" />
                            <span>Vento: {meteo.wind_speed ? `${meteo.wind_speed.toFixed(0)} kn` : '—'} {meteo.raw_data?.forecast?.wind_direction_10m !== undefined ? `(${getWindDirectionCardinal(meteo.raw_data.forecast.wind_direction_10m)})` : ''}</span>
                            {meteo.raw_data?.forecast?.wind_direction_10m !== undefined && (
                                <ArrowUp size={10} className="text-amber-500 inline-block transition-transform ml-0.5" style={{ transform: `rotate(${meteo.raw_data.forecast.wind_direction_10m}deg)` }} />
                            )}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] ${meteo.wave_height > 1.0 ? 'text-red-500 font-extrabold text-xs' : 'font-bold text-slate-300'}`}>
                            <Waves size={11} className={meteo.wave_height > 1.0 ? 'text-red-500' : 'text-cyan-400'} />
                            <span>Onda: {meteo.wave_height ? `${meteo.wave_height.toFixed(1)} m` : '—'}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-[9px] font-bold text-slate-500 italic">Caricamento...</div>
                )}
            </div>
        </div>
    );
}
