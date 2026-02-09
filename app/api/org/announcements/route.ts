import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

// POST - Send a new announcement
export async function POST(request: NextRequest) {
  // Debug log object - returned to frontend so you can see everything
  const debug: Record<string, any> = { steps: [] }
  const log = (step: string, data?: any) => {
    console.log(`[Announcements] ${step}`, data !== undefined ? JSON.stringify(data) : '')
    debug.steps.push({ step, data, time: new Date().toISOString() })
  }

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, body, recipientUserIds } = await request.json()
    log('1. Received request', { title, bodyLength: body?.length, recipientUserIds })

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      log('2. AUTH FAILED', { error: authError?.message })
      return NextResponse.json({ error: 'Unauthorized', debug }, { status: 401 })
    }
    log('2. Auth OK', { userId: user.id, email: user.email })

    // Get org account for this user
    const { data: orgAccount, error: orgError } = await supabaseAdmin
      .from('org_accounts')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (orgError || !orgAccount) {
      log('3. ORG ACCOUNT FAILED', { error: orgError?.message, orgError })
      return NextResponse.json({ error: 'Not an org account', debug }, { status: 403 })
    }

    const organizationId = orgAccount.organization_id
    log('3. Org account found', { organizationId })

    // Get the org name
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const orgName = org?.name || 'An organization'
    log('4. Org name', { orgName })

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
      log('5. INSERT FAILED', { error: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint })
      return NextResponse.json({ error: 'Failed to create announcement: ' + insertError.message, debug }, { status: 500 })
    }
    log('5. Announcement inserted', { id: announcement.id })

    // Determine which members to email
    let targetUserIds: string[] = []

    if (recipientUserIds && Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
      log('6a. Specific recipients requested', { count: recipientUserIds.length, ids: recipientUserIds })
      const { data: validMembers, error: validError } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)
        .in('user_id', recipientUserIds)
      
      log('6a. Valid members query result', { found: validMembers?.length, error: validError?.message })
      targetUserIds = (validMembers || []).map(m => m.user_id)
    } else {
      log('6b. Sending to ALL members')
      const { data: members, error: membersError } = await supabaseAdmin
        .from('user_joined_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)

      log('6b. Members query result', { 
        found: members?.length, 
        error: membersError?.message,
        memberIds: members?.map(m => m.user_id)
      })

      if (membersError) {
        return NextResponse.json({ success: true, announcement, emailsSent: 0, debug })
      }

      targetUserIds = (members || []).map(m => m.user_id)
    }

    log('7. Target user IDs', { count: targetUserIds.length, ids: targetUserIds })

    if (targetUserIds.length === 0) {
      log('7. STOPPING - No target members found')
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug })
    }

    // Get member emails from user_profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, name')
      .in('id', targetUserIds)

    log('8. Profiles query result', { 
      found: profiles?.length, 
      error: profilesError?.message,
      profiles: profiles?.map(p => ({ id: p.id, email: p.email, name: p.name }))
    })

    if (profilesError) {
      log('8. PROFILES QUERY ERROR', { error: profilesError.message, code: profilesError.code, details: profilesError.details })
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug })
    }

    const emails = (profiles || []).filter(p => p.email).map(p => p.email!)
    log('9. Emails extracted', { count: emails.length, emails })

    if (emails.length === 0) {
      log('9. STOPPING - No emails found')
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug })
    }

    // Check Resend API key
    const resendApiKey = process.env.RESEND_API_KEY
    log('10. Resend API key', { exists: !!resendApiKey, keyPrefix: resendApiKey ? resendApiKey.substring(0, 8) + '...' : 'NOT SET' })

    if (!resendApiKey) {
      return NextResponse.json({ success: true, announcement, emailsSent: 0, debug })
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

    // Send to target members
    let emailsSent = 0
    const emailErrors: string[] = []
    const emailSuccesses: string[] = []

    log('11. Starting email send', { totalEmails: emails.length })

    try {
      for (const email of emails) {
        try {
          log(`11. Sending to ${email}...`)
          const result = await resend.emails.send({
            from: 'ORGanize TAMU <noreply@organizecampus.com>',
            to: email,
            subject: `📢 ${orgName}: ${title.trim()}`,
            html: emailHtml,
          })
          log(`11. ✅ Sent to ${email}`, { result })
          emailsSent++
          emailSuccesses.push(email)
        } catch (sendErr: any) {
          const errDetail = sendErr?.message || sendErr?.statusCode || JSON.stringify(sendErr)
          log(`11. ❌ Failed for ${email}`, { error: errDetail, fullError: sendErr })
          emailErrors.push(`${email}: ${errDetail}`)
        }
      }
    } catch (batchErr: any) {
      log('11. BATCH ERROR', { error: batchErr.message })
    }

    log('12. Done', { emailsSent, totalEmails: emails.length, errors: emailErrors })

    return NextResponse.json({ 
      success: true, 
      announcement, 
      emailsSent,
      totalTargeted: emails.length,
      emailSuccesses,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      debug
    })

  } catch (error: any) {
    log('FATAL ERROR', { error: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || 'Internal server error', debug }, { status: 500 })
  }
}
