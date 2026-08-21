-- Per-branch WhatsApp Business sender (Phone Number ID from Meta).
-- Display phone stays in whatsapp_phone. The access token remains in env
-- (one WABA token can send from multiple numbers).

ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
