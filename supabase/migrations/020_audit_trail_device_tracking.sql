-- =====================================================
-- MIGRATION 020: Audit Trail & Device Tracking
-- =====================================================

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES public.vessel_activity(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'UPDATE_LOGBOOK', 'CERTIFY_ACTIVITY', etc.
    old_values JSONB,
    new_values JSONB,
    device_info JSONB, -- { userAgent, ip, screen, platform, deviceId }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add RLS Policies for Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all audit logs
CREATE POLICY "Admins can view all audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('operation_admin', 'operation')
    )
);

-- 3. Function to cleanup old audit logs (Enterprise Maintenance)
-- Keeps logs for 12 months
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.audit_logs WHERE created_at < (NOW() - INTERVAL '12 months');
END;
$$ LANGUAGE plpgsql;

-- 4. Grant access to authenticated users to insert their own logs
-- (Safe because the trigger/function can validate the user_id if needed)
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

COMMENT ON TABLE public.audit_logs IS 'Traccia ogni modifica sensibile ai logbook includendo il fingerprint del dispositivo per la sicurezza Enterprise.';
