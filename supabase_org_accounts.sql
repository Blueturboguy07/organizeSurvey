-- ============================================================================
-- Organization Accounts Table Schema for Supabase
-- Run this SQL in Supabase SQL Editor to create org_accounts table
-- ============================================================================

-- Create org_accounts table to link Supabase auth users with organizations
CREATE TABLE IF NOT EXISTS org_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to Supabase auth user
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Link to organization
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    
    -- Contact email (from organization's administrative_contact_info)
    email TEXT NOT NULL,
    
    -- Verification status
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_accounts_user_id ON org_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_org_accounts_organization_id ON org_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_accounts_email ON org_accounts(email);
CREATE INDEX IF NOT EXISTS idx_org_accounts_verification_token ON org_accounts(verification_token);

-- Enable Row Level Security
ALTER TABLE org_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read org accounts (to check platform status on public pages)
-- This allows both authenticated and unauthenticated users to verify if an org is on platform
DROP POLICY IF EXISTS "Users can read own org account" ON org_accounts;
DROP POLICY IF EXISTS "Authenticated users can read org accounts" ON org_accounts;
CREATE POLICY "Public can read org accounts" ON org_accounts
    FOR SELECT USING (true);

-- Policy: Users can update their own org account
CREATE POLICY "Users can update own org account" ON org_accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Service role can do anything (for verification flow)
CREATE POLICY "Service role full access" ON org_accounts
    FOR ALL USING (auth.role() = 'service_role');

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_org_accounts_updated_at ON org_accounts;
CREATE TRIGGER update_org_accounts_updated_at
    BEFORE UPDATE ON org_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Update organizations table RLS for org account editing
-- ============================================================================

-- Enable RLS on organizations if not already enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read organizations (for search, discovery)
DROP POLICY IF EXISTS "Organizations are publicly readable" ON organizations;
CREATE POLICY "Organizations are publicly readable" ON organizations
    FOR SELECT USING (true);

-- Policy: Org account owners can update their organization
DROP POLICY IF EXISTS "Org accounts can update their organization" ON organizations;
CREATE POLICY "Org accounts can update their organization" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM org_accounts 
            WHERE org_accounts.organization_id = organizations.id 
            AND org_accounts.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Enable realtime for org_accounts and organizations
-- ============================================================================
-- Run these separately if needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE org_accounts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE organizations;

