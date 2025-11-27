-- Migration script to add 'rejected' status to tickets table
-- Run this script if your database already exists

-- Drop the old constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

-- Add the new constraint with 'rejected' status
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('waiting', 'in_room', 'completed', 'cancelled', 'rejected'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'tickets'::regclass AND conname = 'tickets_status_check';
