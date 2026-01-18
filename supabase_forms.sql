-- ============================================================================
-- Custom Forms System Schema for Supabase
-- Run this SQL in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- Organization Forms Table (one form per org)
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_forms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to organization (one form per org)
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    
    -- Form metadata
    title TEXT DEFAULT 'Application Form',
    description TEXT,
    
    -- Form settings
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_forms_organization_id ON org_forms(organization_id);

-- ============================================================================
-- Form Questions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS form_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to form
    form_id UUID NOT NULL REFERENCES org_forms(id) ON DELETE CASCADE,
    
    -- Question content
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('short_text', 'long_text', 'multiple_choice')),
    
    -- Question settings
    is_required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL DEFAULT 0,
    
    -- Type-specific settings (stored as JSONB)
    -- For long_text: { "word_limit": 500 }
    -- For multiple_choice: { "options": ["Option 1", "Option 2", "Option 3"], "allow_multiple": false }
    settings JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id ON form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_order ON form_questions(form_id, order_index);

-- ============================================================================
-- Application Responses Table (stores answers to form questions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS application_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to application
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    
    -- Link to question
    question_id UUID NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
    
    -- Response content
    response_text TEXT,
    response_options JSONB, -- For multiple choice: ["selected option 1", "selected option 2"]
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One response per question per application
    UNIQUE(application_id, question_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_application_responses_application_id ON application_responses(application_id);
CREATE INDEX IF NOT EXISTS idx_application_responses_question_id ON application_responses(question_id);

-- ============================================================================
-- Application Drafts Table (for autosave before submission)
-- ============================================================================
CREATE TABLE IF NOT EXISTS application_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User and org (unique per user per org)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Draft data (stores all responses as JSONB)
    -- Format: { "question_id": "response_text", ... }
    draft_data JSONB DEFAULT '{}',
    
    -- Basic info fields
    applicant_name TEXT,
    applicant_email TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One draft per user per org
    UNIQUE(user_id, organization_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_application_drafts_user_id ON application_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_application_drafts_organization_id ON application_drafts(organization_id);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE org_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_drafts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for org_forms
-- ============================================================================

-- Anyone can read active forms (for applying)
CREATE POLICY "Public can read active forms" ON org_forms
    FOR SELECT USING (is_active = true);

-- Org owners can manage their form
CREATE POLICY "Org owners can manage their form" ON org_forms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM org_accounts 
            WHERE org_accounts.organization_id = org_forms.organization_id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for form_questions
-- ============================================================================

-- Anyone can read questions for active forms
CREATE POLICY "Public can read form questions" ON form_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_forms 
            WHERE org_forms.id = form_questions.form_id 
            AND org_forms.is_active = true
        )
    );

-- Org owners can manage questions for their form
CREATE POLICY "Org owners can manage form questions" ON form_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM org_forms
            JOIN org_accounts ON org_accounts.organization_id = org_forms.organization_id
            WHERE org_forms.id = form_questions.form_id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for application_responses
-- ============================================================================

-- Users can read their own responses
CREATE POLICY "Users can read own responses" ON application_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM applications 
            WHERE applications.id = application_responses.application_id 
            AND applications.user_id = auth.uid()
        )
    );

-- Users can create responses for their applications
CREATE POLICY "Users can create responses" ON application_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM applications 
            WHERE applications.id = application_responses.application_id 
            AND applications.user_id = auth.uid()
        )
    );

-- Org owners can read responses to their applications
CREATE POLICY "Org owners can read responses" ON application_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM applications
            JOIN org_accounts ON org_accounts.organization_id = applications.organization_id
            WHERE applications.id = application_responses.application_id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for application_drafts
-- ============================================================================

-- Users can manage their own drafts
CREATE POLICY "Users can manage own drafts" ON application_drafts
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_org_forms_updated_at ON org_forms;
CREATE TRIGGER update_org_forms_updated_at
    BEFORE UPDATE ON org_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_form_questions_updated_at ON form_questions;
CREATE TRIGGER update_form_questions_updated_at
    BEFORE UPDATE ON form_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_responses_updated_at ON application_responses;
CREATE TRIGGER update_application_responses_updated_at
    BEFORE UPDATE ON application_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_application_drafts_updated_at ON application_drafts;
CREATE TRIGGER update_application_drafts_updated_at
    BEFORE UPDATE ON application_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Enable realtime for all form-related tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE org_forms;
ALTER PUBLICATION supabase_realtime ADD TABLE form_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE application_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE application_drafts;

