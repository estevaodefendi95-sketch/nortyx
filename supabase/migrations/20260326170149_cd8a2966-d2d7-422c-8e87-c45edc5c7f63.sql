CREATE TABLE public.push_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert push_subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read push_subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete push_subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING (true);