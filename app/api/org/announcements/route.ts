import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

// POST - Send a new announcement
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, body, recipientUserIds } = await request.json()

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org account for this user
    const { data: orgAccount, error: orgError } = await supabaseAdmin
      .from('org_accounts')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (orgError || !orgAccount) {
      return NextResponse.json({ error: 'Not an org account' }, { status: 403 })
    }

    const organizationId = orgAccount.organization_id

    // Get the org name
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const orgName = org?.name || 'An organization'

    // Insert announcement
    const { data: announcement, error: insertError } = await supabaseAdmin
      .from('org_announcements')
      .insert({
        organization_id: organizationId,
        title: title.trim(),
        body: body.trim(),
        sent_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert announcement error:', insertError)
      return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
    }

    // Determine which members to email
    let targetUserIds: string[] = []

    if (recipientUserIds && Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
      // Send to specific members only
      // Verify they are actually members of this org
      const { data: validMembers } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)
        .in('user_id', recipientUserIds)
      
      targetUserIds = (validMembers || []).map(m => m.user_id)
    } else {
      // Send to all members
      const { data: members, error: membersError } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)

      if (membersError) {
        console.error('Error fetching members:', membersError)
        return NextResponse.json({ success: true, announcement, emailsSent: 0 })
      }

      targetUserIds = (members || []).map(m => m.user_id)
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: true, announcement, emailsSent: 0 })
    }

    // Get member emails from user_profiles (column is "email", not "first_name")
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, name')
      .in('id', targetUserIds)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({ success: true, announcement, emailsSent: 0 })
    }

    const emails = (profiles || []).filter(p => p.email).map(p => p.email!)

    console.log(`[Announcements] Found ${profiles?.length || 0} profiles, ${emails.length} with emails, for ${targetUserIds.length} target members`)

    if (emails.length === 0) {
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug: 'No emails found in user_profiles for target members' })
    }

    // Send emails via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set')
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug: 'RESEND_API_KEY not configured' })
    }

    const resend = new Resend(resendApiKey)

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #500000 0%, #732F2F 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ORGanize TAMU</h1>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">📢</span>
          </div>
          
          <h2 style="color: #500000; margin-top: 0; text-align: center;">Announcement from ${orgName}</h2>
          
          <div style="background: #f8f9fa; border-left: 4px solid #500000; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">${title.trim()}</h3>
            <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${body.trim()}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://organizecampus.com/dashboard" 
               style="display: inline-block; background: #500000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Go to Dashboard
            </a>
          </div>
          
          <p style="color: #999; font-size: 13px; margin-top: 30px; text-align: center;">
            You received this because you are a member of ${orgName} on ORGanize TAMU.
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            ORGanize TAMU - Connecting Aggies with Organizations
          </p>
        </div>
      </div>
    `

    // Send to target members (batch)
    let emailsSent = 0
    const emailErrors: string[] = []
    try {
      const batchSize = 50
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(email =>
            resend.emails.send({
              from: 'ORGanize TAMU <noreply@organizecampus.com>',
              to: email,
              subject: `📢 ${orgName}: ${title.trim()}`,
              html: emailHtml,
            })
          )
        )
        
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            emailsSent++
          } else {
            const errMsg = result.reason?.message || 'Unknown error'
            console.error(`Failed to send to ${batch[idx]}:`, errMsg)
            emailErrors.push(`${batch[idx]}: ${errMsg}`)
          }
        })
      }
    } catch (emailErr: any) {
      console.error('Email sending error:', emailErr)
    }

    console.log(`✅ Announcement sent by ${orgName}: "${title}" to ${emailsSent}/${emails.length} members`)

    return NextResponse.json({ 
      success: true, 
      announcement, 
      emailsSent,
      totalTargeted: emails.length,
      errors: emailErrors.length > 0 ? emailErrors : undefined
    })

  } catch (error: any) {
    console.error('Announcement API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
