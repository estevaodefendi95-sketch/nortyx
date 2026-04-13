CREATE OR REPLACE FUNCTION public.update_push_schedule(utc_hour integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule('daily-push-reminder');
  
  PERFORM cron.schedule(
    'daily-push-reminder',
    '0 ' || utc_hour::text || ' * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://jnfndqfyurqwbafoxjms.supabase.co/functions/v1/send-push',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZm5kcWZ5dXJxd2JhZm94am1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjk2MjksImV4cCI6MjA4ODkwNTYyOX0.hdXmvS22imXs-6zwlQl9oKev0XowlCVSL822pvG9W3c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
    $cron$
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_push_schedule_hour()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT substring(schedule from '^\d+ (\d+)')::integer
     FROM cron.job
     WHERE jobname = 'daily-push-reminder'
     LIMIT 1),
    21
  );
$$;