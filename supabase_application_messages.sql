-- Add interview_message column to applications table
-- This stores messages sent by org to applicant when moving to interview status

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS interview_message TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_interview_message ON public.applications(id) WHERE interview_message IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.applications.interview_message IS 'Message from organization to applicant when moved to interview status';
