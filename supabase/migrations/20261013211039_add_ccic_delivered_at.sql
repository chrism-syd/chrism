-- Add the optional delivery timestamp to existing CCIC orders.
-- Preserve existing order data, statuses, and permissions.

ALTER TABLE public.ccic_orders
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
