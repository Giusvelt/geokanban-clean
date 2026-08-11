-- Enable pg_cron extension (if available on the project tier)
-- Note: pg_cron is available on Pro tier and above for Supabase.
-- For Free tier, you must use an external cron service (like GitHub Actions or cron-job.org) hitting the Edge Function based on its URL.
create extension if not exists pg_cron;

-- Schedule the edge function to run every hour
-- The function URL needs to be the deployed URL. Since we don't know the exact project ref here in SQL easily,
-- providing a generic placeholder. In reality, you'd use:
-- select cron.schedule('fetch-vessel-positions', '0 * * * *', $$
--     select
--         net.http_post(
--             url:='https://<PROJECT_REF>.supabase.co/functions/v1/fetch-vessel-positions',
--             headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
--         ) as request_id;
-- $$);

-- ALTERNATIVE: Use pg_net to call the function
create extension if not exists pg_net;

-- This is a template. The user needs to verify if they have pg_cron enabled.
-- If not, we will rely on external trigger or manual trigger for now.
-- For now, let's just creating the table for logs is enough assurance.

CREATE TABLE IF NOT EXISTS cron_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name TEXT,
    status TEXT,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    result JSONB
);

-- We leave the actual CRON setup commented out because it requires the PROJECT REF and SERVICE_ROLE KEY which are secrets.
-- The user should set this up via Dashboard -> Database -> Extensions -> pg_cron OR use an external trigger.
