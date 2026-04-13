
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS notify_hour INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS notify_minute INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Authenticated users can update push_subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
