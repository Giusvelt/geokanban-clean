-- =====================================================
-- MIGRATION 019: Business Intelligence & KPI Views
-- =====================================================

-- Questa vista raggruppa le statistiche dell'intera flotta per mese e anno
-- IMPLEMENTATA REGOLA PM: le attività con durata < 20 minuti vengono SCARTATE dal KPI.
CREATE OR REPLACE VIEW monthly_fleet_kpi WITH (security_invoker=true) AS
SELECT 
    EXTRACT(MONTH FROM va.start_time) AS month,
    EXTRACT(YEAR FROM va.start_time) AS year,
    COUNT(*) FILTER (WHERE va.activity_type = 'Loading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS loading_count,
    COUNT(*) FILTER (WHERE va.activity_type = 'Navigation' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS navigation_count,
    COUNT(*) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS unloading_count,
    COALESCE(SUM(CAST(le.structured_fields->>'actual_cargo_tonnes' AS NUMERIC)) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)), 0) AS delivered_tons
FROM vessel_activity va
LEFT JOIN logbook_entries le ON le.vessel_activity_id = va.id AND le.status IN ('submitted', 'approved')
WHERE va.start_time IS NOT NULL
GROUP BY EXTRACT(YEAR FROM va.start_time), EXTRACT(MONTH FROM va.start_time);


-- Questa vista raggruppa i target certificati ed effettivi spezzati per singola Nave (Vessel)
CREATE OR REPLACE VIEW monthly_vessel_kpi WITH (security_invoker=true) AS
SELECT 
    v.id AS vessel_id,
    v.name AS vessel_name,
    EXTRACT(MONTH FROM va.start_time) AS month,
    EXTRACT(YEAR FROM va.start_time) AS year,
    COUNT(va.id) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS actual_trips,
    COUNT(va.id) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) * v.avg_cargo AS actual_quantity_estimated,
    COALESCE(SUM(CAST(le.structured_fields->>'actual_cargo_tonnes' AS NUMERIC)) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)), 0) AS actual_quantity_certified
FROM vessels v
LEFT JOIN vessel_activity va ON v.id = va.vessel_id
LEFT JOIN logbook_entries le ON le.vessel_activity_id = va.id AND le.status IN ('submitted', 'approved')
WHERE va.start_time IS NOT NULL
GROUP BY v.id, v.name, v.avg_cargo, EXTRACT(YEAR FROM va.start_time), EXTRACT(MONTH FROM va.start_time);
