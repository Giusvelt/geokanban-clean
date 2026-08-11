-- =====================================================
-- MIGRATION 007: Production Planning & Vessel Specs
-- =====================================================

-- 1. Update Vessels table with Cargo capacity
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS avg_cargo NUMERIC DEFAULT 0;
COMMENT ON COLUMN vessels.avg_cargo IS 'Average cargo capacity in Tons for production calculations.';

-- 2. Create Production Plans table (Level above Work Program)
CREATE TABLE IF NOT EXISTS public.production_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL, -- e.g., 'Febbrao 2026', 'Week 08'
    target_trips INTEGER DEFAULT 0,
    target_quantity NUMERIC DEFAULT 0, -- target_trips * avg_cargo
    actual_trips INTEGER DEFAULT 0,
    actual_quantity NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vessel_id, period_name)
);

-- 3. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_production_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_production_plans_updated_at
    BEFORE UPDATE ON public.production_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_production_plan_timestamp();

-- 4. Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to production_plans" ON production_plans FOR ALL USING (true);
