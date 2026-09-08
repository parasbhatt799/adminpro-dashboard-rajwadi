-- Add b2b_whatsapp_numbers column to payout_settings table
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS b2b_whatsapp_numbers TEXT DEFAULT '';
