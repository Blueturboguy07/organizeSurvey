import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

// Send notification email when application status changes
export async function POST(request: Request) {
  try {
    const { applicationId, newStatus, organizationName } = await request.json()

    if (!applicationId || !newStatus || !organizationName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get application details
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('applicant_name, applicant_email')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    const { applicant_name, applicant_email } = application

    if (!applicant_email) {
      return NextResponse.json(
        { error: 'No email address for applicant' },
        { status: 400 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    let subject = ''
    let heading = ''
    let message = ''
    let backgroundColor = ''
    let textColor = ''
    let icon = ''

    switch (newStatus) {
      case 'accepted':
        subject = `Congratulations! You've been accepted to ${organizationName}`
        heading = 'You\'ve Been Accepted!'
        message = `Great news! ${organizationName} has reviewed your application and is excited to welcome you as a member. Log in to ORGanize TAMU to join the organization.`
        backgroundColor = '#dcfce7'
        textColor = '#166534'
        icon = '🎉'
        break
      
      case 'rejected':
        subject = `Application Update from ${organizationName}`
        heading = 'Application Status Update'
        message = `Thank you for your interest in ${organizationName}. After careful review, they've decided to move forward with other candidates at this time. Don't be discouraged - there are many other great organizations waiting for you!`
        backgroundColor = '#fee2e2'
        textColor = '#991b1b'
        icon = '📋'
        break
      
      case 'interview':
        subject = `Interview Invitation from ${organizationName}`
        heading = 'You\'ve Been Selected for an Interview!'
        message = `Exciting news! ${organizationName} was impressed with your application and would like to learn more about you. Log in to ORGanize TAMU to check for more details.`
        backgroundColor = '#dbeafe'
        textColor = '#1e40af'
        icon = '📅'
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid status for notification' },
          { status: 400 }
        )
    }

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #500000 0%, #732F2F 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ORGanize TAMU</h1>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">${icon}</span>
          </div>
          
          <h2 style="color: #500000; margin-top: 0; text-align: center;">${heading}</h2>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${applicant_name},
          </p>
          
          <div style="background: ${backgroundColor}; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: ${textColor}; font-size: 16px;">
              ${message}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://organizecampus.com/dashboard/applications" 
               style="display: inline-block; background: #500000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View Your Application
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Questions? Email <a href="mailto:mannbellani1@tamu.edu" style="color: #500000;">mannbellani1@tamu.edu</a>
          </p>
        </div>
        
        <div style="background: #f5f5f5; padding: 20px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            ORGanize TAMU - Connecting Aggies with Organizations
          </p>
        </div>
      </div>
    `

    await resend.emails.send({
      from: 'ORGanize TAMU <noreply@organizecampus.com>',
      to: applicant_email,
      subject: subject,
      html: emailHtml,
    })

    console.log(`✅ Sent ${newStatus} notification to ${applicant_email} for ${organizationName}`)

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${applicant_email}`
    })

  } catch (error: any) {
    console.error('Application notification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
