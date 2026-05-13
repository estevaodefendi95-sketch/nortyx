-- Make tab_visibility unique per (organization, user, tab) instead of just (user, tab),
-- so admins can save independent settings for each organization they belong to.

-- Drop old unique constraint
ALTER TABLE public.tab_visibility
  DROP CONSTRAINT IF EXISTS tab_visibility_user_id_tab_id_key;

-- Remove duplicates that would block the new constraint (keep most recent by id)
DELETE FROM public.tab_visibility a
USING public.tab_visibility b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.tab_id = b.tab_id
  AND COALESCE(a.organization_id::text, '') = COALESCE(b.organization_id::text, '');

-- New composite uniqueness including organization
CREATE UNIQUE INDEX IF NOT EXISTS tab_visibility_org_user_tab_key
  ON public.tab_visibility (organization_id, user_id, tab_id);