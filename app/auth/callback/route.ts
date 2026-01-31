import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/survey'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check if this is an org account and update verification status
      if (data.user.user_metadata?.is_org_account) {
        const organizationId = data.user.user_metadata?.organization_id
        
        if (organizationId) {
          // Update org_accounts to mark as verified
          await supabaseAdmin
            .from('org_accounts')
            .update({ email_verified: true })
            .eq('organization_id', organizationId)
          
          console.log('Org account verified:', data.user.email)
        }
      }

      // Auto-join any organizations that invited this user by email
      if (data.user.email) {
        try {
          // Find all pending invitations for this email
          const { data: pendingInvites } = await supabaseAdmin
            .from('org_invitations')
            .select('id, organization_id, expires_at')
            .eq('email', data.user.email.toLowerCase())
            .eq('status', 'pending')
          
          if (pendingInvites && pendingInvites.length > 0) {
            for (const invitation of pendingInvites) {
              // Skip expired invitations
              if (new Date(invitation.expires_at) < new Date()) {
                await supabaseAdmin
                  .from('org_invitations')
                  .update({ status: 'expired' })
                  .eq('id', invitation.id)
                continue
              }
              
              // Check if user is already a member
              const { data: existingMembership } = await supabaseAdmin
                .from('user_joined_organizations')
                .select('id')
                .eq('organization_id', invitation.organization_id)
                .eq('user_id', data.user.id)
                .single()
              
              if (!existingMembership) {
                // Add user to organization
                await supabaseAdmin
                  .from('user_joined_organizations')
                  .insert({
                    user_id: data.user.id,
                    organization_id: invitation.organization_id,
                  })
                
                console.log('User auto-joined organization:', invitation.organization_id)
              }
              
              // Update invitation status
              await supabaseAdmin
                .from('org_invitations')
                .update({
                  status: 'accepted',
                  accepted_by_user_id: data.user.id,
                  accepted_at: new Date().toISOString(),
                })
                .eq('id', invitation.id)
            }
          }
        } catch (inviteErr) {
          console.error('Error processing invites during auth callback:', inviteErr)
          // Don't fail the whole callback
        }
      }
      
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(new URL('/login', request.url))
}

