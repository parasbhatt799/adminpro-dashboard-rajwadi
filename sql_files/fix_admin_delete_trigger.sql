-- Fix God Admin protection trigger so other admins can be deleted normally
-- In PostgreSQL BEFORE DELETE triggers, returning NULL (or NEW, which is NULL in DELETE) cancels the deletion.
-- The trigger must return OLD on DELETE to allow non-God admins to be deleted.

CREATE OR REPLACE FUNCTION protect_god_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the target is the God Admin (7777077377)
  IF (OLD.mobile_number = '7777077377') THEN
    -- Prevent Deletion of God Admin
    IF (TG_OP = 'DELETE') THEN
      RAISE EXCEPTION 'CRITICAL SECURITY: The God Admin account (7777077377) is permanent and cannot be deleted.';
    END IF;
    
    -- Prevent specific updates (status or role)
    IF (TG_OP = 'UPDATE') THEN
      IF (NEW.status != OLD.status OR NEW.role != OLD.role) THEN
        RAISE EXCEPTION 'CRITICAL SECURITY: The access level and status of the God Admin account (7777077377) are immutable.';
      END IF;
    END IF;
  END IF;
  
  -- For non-God admins:
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD; -- MUST return OLD to permit deletion in PostgreSQL
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS tr_god_admin_protection ON admin_profiles;
CREATE TRIGGER tr_god_admin_protection
BEFORE UPDATE OR DELETE ON admin_profiles
FOR EACH ROW
EXECUTE FUNCTION protect_god_admin();

-- Also ensure anon key or authenticated users have delete policy if needed
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_profiles_delete_policy" ON public.admin_profiles;
CREATE POLICY "admin_profiles_delete_policy" ON public.admin_profiles 
FOR DELETE 
USING (mobile_number != '7777077377' AND mobile_number != '9999099999');
