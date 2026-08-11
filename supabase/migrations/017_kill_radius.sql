-- =====================================================
-- MIGRATION 017: Disintegrazione Definitiva del Radius
-- =====================================================

-- Sostituiamo il trigger rimuovendo il blocco di fallback (ST_DWithin).
-- Da questo momento la nave VIENE REGISTRATA SOLO SE INTERSECA IL POLIGONO.

CREATE OR REPLACE FUNCTION public.track_production_on_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_geofence_id UUID;
    v_geofence_nature TEXT;
    v_vessel_avg_cargo NUMERIC;
    v_plan_id UUID;
    v_current_point GEOMETRY;
BEGIN
    -- Prepariamo il punto corrente
    v_current_point := ST_SetSRID(ST_Point(NEW.lon, NEW.lat), 4326);

    -- 1. TROVA LA GEOFENCE USANDO SOLO IL POLIGONO (Nessun Fallback!)
    SELECT id, nature INTO v_geofence_id, v_geofence_nature
    FROM public.geofences
    WHERE ST_Intersects(polygon, v_current_point)
    OR ST_Contains(polygon, v_current_point)
    LIMIT 1;

    -- Se v_geofence_id è NULL, la nave NON è in nessuna geofence validata.
    -- Non facciamo nient'altro, fine della storia.

    -- 2. Se siamo in un UNLOADING SITE (Cantiere/Sito Scarico) e il poligono ha fatto match
    IF v_geofence_id IS NOT NULL AND v_geofence_nature = 'unloading_site' THEN
        
        -- Debounce: Evitiamo doppi conteggi (max 1 trip ogni 4 ore)
        IF NOT EXISTS (
            SELECT 1 FROM public.production_plans_logs 
            WHERE vessel_id = NEW.vessel_id 
            AND action = 'trip_increment'
            AND created_at > (NOW() - INTERVAL '4 hours')
        ) THEN
            
            -- Trova il piano di produzione attivo
            v_plan_id := public.get_active_production_plan(NEW.vessel_id);
            
            IF v_plan_id IS NOT NULL THEN
                -- Capacità media nave
                SELECT avg_cargo INTO v_vessel_avg_cargo FROM public.vessels WHERE id = NEW.vessel_id;

                -- Incremento Viaggio e Quantità
                UPDATE public.production_plans
                SET 
                    actual_trips = actual_trips + 1,
                    actual_quantity = actual_quantity + COALESCE(v_vessel_avg_cargo, 0),
                    updated_at = NOW()
                WHERE id = v_plan_id;

                -- Log dell'evento
                INSERT INTO public.production_plans_logs (vessel_id, action)
                VALUES (NEW.vessel_id, 'trip_increment');
                
                RAISE NOTICE 'Trip incrementato per nave % nel geofence % (PURAMENTE POLYGON)', NEW.vessel_id, v_geofence_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aggiorniamo il commento per chiarire
COMMENT ON FUNCTION public.track_production_on_entry IS 'LOGICA PURA: Usa esclusivamente ST_Intersects sui poligoni. Il radius è stato disintegrato.';
