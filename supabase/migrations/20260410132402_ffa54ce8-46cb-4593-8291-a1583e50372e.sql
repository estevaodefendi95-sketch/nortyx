
CREATE TABLE public.tab_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tab_id text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, tab_id)
);

ALTER TABLE public.tab_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tab visibility"
ON public.tab_visibility FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tab visibility"
ON public.tab_visibility FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tab visibility"
ON public.tab_visibility FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert tab visibility"
ON public.tab_visibility FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all tab visibility"
ON public.tab_visibility FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tab visibility"
ON public.tab_visibility FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
