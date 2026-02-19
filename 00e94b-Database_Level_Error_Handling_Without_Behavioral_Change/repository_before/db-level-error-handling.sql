-- Function to cancel unverified email tasks
CREATE OR REPLACE FUNCTION cancel_unverified_parent_emails()
RETURNS TRIGGER AS $$
BEGIN
 -- If confirmed_at is updated from NULL to a non-NULL value
 IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
   -- Mark all pending tasks as completed
   UPDATE public.parent_scheduled_tasks
   SET completed_at = NOW(),
       is_cancelled = true
   WHERE parent_id IN (SELECT uuid FROM public.parents WHERE supabase_id = NEW.id)
     AND task_type IN (
       'send_unverified_email_3_days',
       'send_unverified_email_5_days',
       'send_unverified_email_10_days'
     )
     AND completed_at IS NULL;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cancel_unverified_emails_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION cancel_unverified_parent_emails();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_unverified_parent_emails TO authenticated;