-- Migration to add 'duplicated' status to transaction_status enum
-- This is needed for existing databases that already have the enum type

ALTER TYPE transaction_status ADD VALUE 'duplicated'; 