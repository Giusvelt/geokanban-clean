import React from 'react';
import { CalendarDays } from 'lucide-react';

export const TimeInput = ({ label, value, onChange, disabled, baseDate }) => {
    const d = value ? new Date(value) : (baseDate ? new Date(baseDate) : new Date());
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const dateVal = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    const handleTimeChange = (newHH, newMM) => {
        const newD = new Date(baseDate || value || new Date());
        newD.setHours(parseInt(newHH), parseInt(newMM), 0, 0);
        onChange(newD.toISOString());
    };

    return (
        <div className="lem-time-input-wrapper">
            <span className="lem-label">{label}</span>
            <div className={`lem-time-box ${disabled ? 'disabled' : ''}`}>
                <div className="lem-time-date-ref">
                    <CalendarDays size={12} />
                    <span>{dateVal}</span>
                </div>
                <div className="lem-wheel-picker">
                    <select 
                        value={hh} 
                        onChange={(e) => handleTimeChange(e.target.value, mm)}
                        disabled={disabled}
                        className="lem-time-wheel"
                    >
                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="lem-time-sep">:</span>
                    <select 
                        value={mm} 
                        onChange={(e) => handleTimeChange(hh, e.target.value)}
                        disabled={disabled}
                        className="lem-time-wheel"
                    >
                        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
};
