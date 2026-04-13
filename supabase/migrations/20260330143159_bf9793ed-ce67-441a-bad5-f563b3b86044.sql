
ALTER TABLE public.transactions 
ADD COLUMN recurrence_type text DEFAULT null,
ADD COLUMN recurrence_group_id text DEFAULT null;

COMMENT ON COLUMN public.transactions.recurrence_type IS 'daily, weekly, monthly or null';
COMMENT ON COLUMN public.transactions.recurrence_group_id IS 'UUID grouping recurring transactions together';
