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
      
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Return to login page if there's an error
  return NextResponse.redirect(new URL('/login', request.url))
}

