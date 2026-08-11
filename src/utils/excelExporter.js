import * as XLSX from 'xlsx';
import { formatDate, formatHour, calcDuration } from './timeFormatters';

export const exportActivitiesToExcel = (activities, selectedYear, selectedMonth) => {
    const data = activities.map(a => {
        const entry = a.logbookEntry || {};
        const sf = entry.structured_fields || {};
        
        return {
            'Ref': a.id,
            'Vessel': a.vessel,
            'Activity': a.activity,
            'Stand by in area cantiere': (a.overlappingStandbys && a.overlappingStandbys.length > 0) ? Array(a.overlappingStandbys.length).fill('WhSby').join(' ') : '—',
            'Geofence': a.geofence,
            'Arrived Date': formatDate(a.startTime),
            'Arrived Time': formatHour(a.startTime),
            'Departed Date': a.endTime ? formatDate(a.endTime) : '—',
            'Departed Time': a.endTime ? formatHour(a.endTime) : 'In Progress',
            'Duration': calcDuration(a.startTime, a.endTime),
            'Status': a.logbookStatus || 'None',
            'Messages (Chat History)': a.allMessagesText || '—',
            'Certified Signature': entry.submitted_by_name ? `${entry.submitted_by_name} (${entry.submitted_by_title || '—'})` : 'PENDING',
            'Cargo Tonnes': sf.actual_cargo_tonnes || 0,
            'Arrival Draft': sf.arrival_draft || '—',
            'Departure Draft': sf.departure_draft || '—',
            'Digital Hash': entry.document_hash || '—',
            'Narrative (Notes)': entry.narrative_text || '—',
            'Pilots IN Date': sf.arrival_pilot_in ? formatDate(sf.arrival_pilot_in) : '—',
            'Pilots IN Time': sf.arrival_pilot_in ? formatHour(sf.arrival_pilot_in) : '—',
            'Pilots OUT Date': sf.arrival_pilot_out ? formatDate(sf.arrival_pilot_out) : '—',
            'Pilots OUT Time': sf.arrival_pilot_out ? formatHour(sf.arrival_pilot_out) : '—',
            'Moor IN Date': sf.arrival_mooring_in ? formatDate(sf.arrival_mooring_in) : '—',
            'Moor IN Time': sf.arrival_mooring_in ? formatHour(sf.arrival_mooring_in) : '—',
            'Moor OUT Date': sf.arrival_mooring_out ? formatDate(sf.arrival_mooring_out) : '—',
            'Moor OUT Time': sf.arrival_mooring_out ? formatHour(sf.arrival_mooring_out) : '—',
            'Tug Units': sf.arrival_tug_count || 0,
            'Tug Start Date': sf.arrival_tug_in ? formatDate(sf.arrival_tug_in) : '—',
            'Tug Start Time': sf.arrival_tug_in ? formatHour(sf.arrival_tug_in) : '—',
            'Tug End Date': sf.arrival_tug_out ? formatDate(sf.arrival_tug_out) : '—',
            'Tug End Time': sf.arrival_tug_out ? formatHour(sf.arrival_tug_out) : '—',
            'Weather Wave': a.weatherWave || '—',
            'Weather Wind': a.weatherWind || '—',
            'Weather Standby Alert': a.probable_weather_standby ? 'YES (Wave > 1m)' : '—'
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Certified Activities");
    XLSX.writeFile(wb, `GeoKanban_Certified_Export_${selectedYear}_${selectedMonth + 1}.xlsx`);
};
