/*
  SQL FIX: GeoKanban v3.15 User Creation Function
  Instruzioni: Incolla l'intero codice nell'Editor SQL del tuo Dashboard Supabase ed eseguilo.
*/

-- 1. Assicuriamoci che pgcrypto sia attivo
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Creazione della funzione RPC per la creazione utenti sicura
-- 0. Rimuovi le vecchie versioni della funzione per evitare conflitti (Overloading)
DROP FUNCTION IF EXISTS public.create_new_user_v3(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_new_user_v3(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_new_user_v3(
    p_email TEXT,
    p_password TEXT,
    p_display_name TEXT,
    p_role TEXT,
    p_company_id UUID DEFAULT NULL,
    p_vessel_id UUID DEFAULT NULL,
    p_mmsi TEXT DEFAULT NULL,
    p_custom_overrides JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Cruciale: permette alla funzione di agire con i privilegi del database
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- STEP A: Creazione dell'utente in auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email,
        crypt(p_password, gen_salt('bf')), NOW(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('full_name', p_display_name), NOW(), NOW()
    )
    RETURNING id INTO v_user_id;

    -- STEP A.2: Inserimento in auth.identities (MANDATORIO per Supabase GoTrue)
    INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(), v_user_id::text, v_user_id,
        jsonb_build_object('sub', v_user_id, 'email', p_email),
        'email', NOW(), NOW()
    );

    -- STEP B: Creazione del profilo in public.user_profiles
    INSERT INTO public.user_profiles (
        id, display_name, email, role, company_id, vessel_id, mmsi, custom_overrides, is_blocked, created_at
    )
    VALUES (
        v_user_id, p_display_name, p_email, p_role, p_company_id, p_vessel_id, p_mmsi, p_custom_overrides, FALSE, NOW()
    );

    RETURN v_user_id;
END;
$$;

-- 3. Concedi i permessi di esecuzione alla funzione per gli utenti loggati (Admin)
GRANT EXECUTE ON FUNCTION public.create_new_user_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_new_user_v3 TO service_role;

-- 4. Ricarica la cache di Supabase (CRUCIALE)
NOTIFY pgrst, 'reload schema';
