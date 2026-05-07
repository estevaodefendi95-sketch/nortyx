CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(organization_id, email)
);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage invites"
ON public.organization_invites FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = organization_invites.organization_id AND role IN ('owner'::org_role, 'admin'::org_role)))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = organization_invites.organization_id AND role IN ('owner'::org_role, 'admin'::org_role)));

CREATE POLICY "Users can read invites for their email"
ON public.organization_invites FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Super user manages all invites"
ON public.organization_invites FOR ALL TO authenticated
USING (is_super_user(auth.uid()))
WITH CHECK (is_super_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.accept_pending_invites(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _count int := 0;
  _invite record;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NULL THEN RETURN 0; END IF;

  FOR _invite IN
    SELECT * FROM public.organization_invites
    WHERE lower(email) = lower(_email) AND accepted_at IS NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = _invite.organization_id AND user_id = _user_id
    ) THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (_invite.organization_id, _user_id, _invite.role);
    END IF;

    UPDATE public.organization_invites SET accepted_at = now() WHERE id = _invite.id;

    UPDATE public.profiles
    SET organization_id = _invite.organization_id, approved = true
    WHERE user_id = _user_id;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;