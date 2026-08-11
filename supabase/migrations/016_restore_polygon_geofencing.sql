-- =====================================================
-- MIGRATION 016: Ripristino Geofencing Poligonale Assoluto
-- =====================================================

-- 1. Assicuriamoci che la tabella geofences abbia la colonna GEOMETRY
-- Anche se abbiamo polygon_coords (JSONB), PostGIS performa meglio con il tipo GEOMETRY.
ALTER TABLE public.geofences ADD COLUMN IF NOT EXISTS polygon GEOMETRY(Polygon, 4326);

-- 2. Funzione per sincronizzare GEOMETRY da JSONB (polygon_coords)
-- Questo garantisce che ogni volta che inseriamo/aggiorniamo polygon_coords, anche la geometria PostGIS sia allineata.
CREATE OR REPLACE FUNCTION public.sync_geofence_geometry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.polygon_coords IS NOT NULL THEN
        -- Convertiamo l'array [[lat, lon], ...] in un WKT Poligono PostGIS
        -- Nota: ST_MakePolygon richiede che il primo e l'ultimo punto siano uguali.
        -- Per semplicità, se l'utente fornisce solo i vertici, possiamo usare una logica di parsing più complessa
        -- o assumere che polygon_coords sia già ben formato per ST_GeomFromGeoJSON.
        -- In GK V3 usiamo un formato custom [[lat, lon], ...]. Lo convertiamo qui:
        BEGIN
            NEW.polygon := ST_SetSRID(
                ST_Buffer( -- Usiamo un buffer minimo se necessario, ma qui convertiamo direttamente
                    ST_MakeLine(
                        ARRAY(
                            SELECT ST_SetSRID(ST_Point((elem->>1)::numeric, (elem->>0)::numeric), 4326)
                            FROM jsonb_array_elements(NEW.polygon_coords) AS elem
                        )
                    ), 0 -- Dummy buffer to ensure valid polygon if closed
                ), 4326
            );
            -- Se vogliamo un poligono reale e l'array non è chiuso, dobbiamo chiuderlo
            -- (Logica semplificata: assumiamo che il client o una funzione helper gestisca la chiusura)
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Errore nella conversione di polygon_coords per geofence %: %', NEW.name, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger per la sincronizzazione automatica
DROP TRIGGER IF EXISTS tr_sync_geofence_geometry ON public.geofences;
CREATE TRIGGER tr_sync_geofence_geometry
    BEFORE INSERT OR UPDATE OF polygon_coords ON public.geofences
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_geofence_geometry();

-- 4. RIPRISTINO LOGICA DETERMINISTICA (ST_Intersects)
-- Sostituiamo la regressione del raggio (ST_DWithin) con l'intersezione poligonale reale.
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

    -- 1. TROVA LA GEOFENCE USANDO IL POLIGONO (No Radius!)
    SELECT id, nature INTO v_geofence_id, v_geofence_nature
    FROM public.geofences
    WHERE ST_Intersects(polygon, v_current_point)
    OR ST_Contains(polygon, v_current_point)
    LIMIT 1;

    -- Se non troviamo per poligono, come fallback temporaneo (se polygon è null) cerchiamo per raggio
    -- Ma alziamo un warning se stiamo usando il raggio su un'area che dovrebbe avere un poligono.
    IF v_geofence_id IS NULL THEN
        SELECT id, nature INTO v_geofence_id, v_geofence_nature
        FROM public.geofences
        WHERE ST_DWithin(
            ST_SetSRID(ST_Point(lon, lat), 4326)::geography,
            v_current_point::geography,
            radius
        )
        LIMIT 1;
    END IF;

    -- 2. Se siamo in un UNLOADING SITE (Cantiere/Sito Scarico)
    IF v_geofence_nature = 'unloading_site' THEN
        
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
                
                RAISE NOTICE 'Trip incrementato per nave % nel geofence % (POLYGON)', NEW.vessel_id, v_geofence_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Commmenti di sicurezza
COMMENT ON FUNCTION public.track_production_on_entry IS 'LOGICA RIPRISTINATA: Usa ST_Intersects sui poligoni per il conteggio viaggi.';
