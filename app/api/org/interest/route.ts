import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const MILESTONES = [1, 10, 20, 30, 50, 75, 100]

// Record student interest in an org not on platform
export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await request.json()

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Get organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, administrative_contact_info, is_on_platform')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if org is already on platform
    const { data: orgAccount } = await supabaseAdmin
      .from('org_accounts')
      .select('id, email_verified, is_active')
      .eq('organization_id', organizationId)
      .single()

    const isOnPlatform = orgAccount?.email_verified && orgAccount?.is_active

    if (isOnPlatform) {
      // Org is already on platform, no notification needed
      return NextResponse.json({ 
        success: true, 
        notified: false,
        message: 'Organization is already on platform'
      })
    }

    // Get or create interest tracking record
    let { data: interest } = await supabaseAdmin
      .from('org_interest_notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .single()

    if (!interest) {
      // Create new record
      const { data: newInterest, error: createError } = await supabaseAdmin
        .from('org_interest_notifications')
        .insert({
          organization_id: organizationId,
          interest_count: 0,
          last_milestone_notified: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating interest record:', createError)
        return NextResponse.json(
          { error: 'Failed to track interest' },
          { status: 500 }
        )
      }
      interest = newInterest
    }

    // Increment interest count
    const newCount = (interest.interest_count || 0) + 1
    
    // Check if we've hit a new milestone
    const currentMilestone = interest.last_milestone_notified || 0
    const nextMilestone = MILESTONES.find(m => m > currentMilestone && newCount >= m)
    
    let notified = false
    let milestoneHit = null

    if (nextMilestone) {
      // We hit a new milestone - send email
      const orgEmail = org.administrative_contact_info
      
      if (orgEmail && orgEmail.includes('@')) {
        try {
          const subject = nextMilestone === 1 
            ? `A student is interested in ${org.name}!`
            : `${newCount} students are interested in ${org.name}!`
          
          const milestoneMessage = nextMilestone === 1
            ? `A student at Texas A&M just expressed interest in joining your organization!`
            : `${newCount} students at Texas A&M have expressed interest in joining your organization!`
          
          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'ORGanize TAMU <noreply@organizecampus.com>',
            to: orgEmail,
            subject: subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #500000 0%, #732F2F 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">ORGanize TAMU</h1>
                </div>
                
                <div style="padding: 30px; background: #ffffff;">
                  <h2 style="color: #500000; margin-top: 0;">${milestoneMessage}</h2>
                  
                  <p style="color: #333; font-size: 16px; line-height: 1.6;">
                    Students are using ORGanize TAMU to discover organizations like yours. 
                    They want to learn more about <strong>${org.name}</strong> and potentially join!
                  </p>
                  
                  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #333; font-size: 18px; text-align: center;">
                      <strong style="color: #500000; font-size: 32px;">${newCount}</strong><br/>
                      ${newCount === 1 ? 'student is' : 'students are'} interested
                    </p>
                  </div>
                  
                  <p style="color: #333; font-size: 16px; line-height: 1.6;">
                    Register your organization on ORGanize TAMU to:
                  </p>
                  <ul style="color: #333; font-size: 16px; line-height: 1.8;">
                    <li>Reach students actively looking for organizations like yours</li>
                    <li>Manage applications and member recruitment</li>
                    <li>Share your organization's story and attract the right members</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://organizecampus.com/org/setup" 
                       style="display: inline-block; background: #500000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Register Your Organization
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Questions? Reply to this email or visit organizecampus.com
                  </p>
                </div>
                
                <div style="background: #f5f5f5; padding: 20px; text-align: center;">
                  <p style="color: #666; font-size: 12px; margin: 0;">
                    ORGanize TAMU - Connecting Aggies with Organizations
                  </p>
                </div>
              </div>
            `,
          })
          
          notified = true
          milestoneHit = nextMilestone
          console.log(`✅ Sent milestone email to ${orgEmail} for ${org.name} (${newCount} interested)`)
        } catch (emailError) {
          console.error('Error sending interest email:', emailError)
          // Continue even if email fails
        }
      } else {
        console.log(`⚠️ No valid email for ${org.name}, skipping notification`)
      }
    }

    // Update interest record
    await supabaseAdmin
      .from('org_interest_notifications')
      .update({
        interest_count: newCount,
        last_milestone_notified: nextMilestone || currentMilestone,
        last_notified_at: notified ? new Date().toISOString() : interest.last_notified_at,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)

    return NextResponse.json({
      success: true,
      notified,
      milestoneHit,
      interestCount: newCount,
      message: notified 
        ? `Organization notified! ${newCount} students interested.`
        : `Interest recorded. ${newCount} students interested.`
    })

  } catch (error: any) {
    console.error('Interest notification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get interest count for an org
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    const { data: interest } = await supabaseAdmin
      .from('org_interest_notifications')
      .select('interest_count')
      .eq('organization_id', organizationId)
      .single()

    return NextResponse.json({
      interestCount: interest?.interest_count || 0
    })

  } catch (error: any) {
    console.error('Get interest error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
