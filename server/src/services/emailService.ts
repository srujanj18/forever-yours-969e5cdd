import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import admin from 'firebase-admin';

let transporter: nodemailer.Transporter | null = null;
let sendGridEnabled = false;

export const initializeEmailService = async () => {
  try {
    // Try SendGrid first (easiest option)
    const sendGridKey = process.env.SENDGRID_API_KEY;
    if (sendGridKey) {
      sgMail.setApiKey(sendGridKey);
      sendGridEnabled = true;
      console.log('✅ Email service initialized with SendGrid');
      console.log('📧 Free tier: 100 emails/day');
      return true;
    }

    // Try SMTP (Gmail, custom SMTP server)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.verify();
      console.log('✅ Email service initialized with SMTP');
      console.log(`📧 Using SMTP: ${smtpHost}:${smtpPort || 587}`);
      return true;
    }

    // Fallback to Ethereal test account
    console.log('📧 Creating test email account with Ethereal...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('✅ Email service initialized with Ethereal test account');
      console.log('📧 Test emails will show preview URLs in console');
      return true;
    } catch (etherealError) {
      console.warn('⚠️  Could not create Ethereal test account');
      console.warn('Invitations will be logged to console only.');
      return false;
    }
  } catch (error: any) {
    console.warn('⚠️  Email service initialization failed:', error.message);
    console.warn('Invitations will be logged to console only.');
    transporter = null;
    sendGridEnabled = false;
    return false;
  }
};

export const sendInvitationEmail = async (
  recipientEmail: string,
  senderName: string,
  invitationToken: string,
  clientUrl: string
): Promise<boolean> => {
  try {
    const db = admin.firestore();
    const invitationLink = `${clientUrl}/accept-invitation?token=${invitationToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 32px;">💕 You're Invited!</h1>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 40px; text-align: center;">
          <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">
            <strong>${senderName}</strong> wants to connect with you on <strong>ForeverUs</strong>!
          </p>
          
          <p style="font-size: 16px; color: #666; margin: 0 0 30px 0;">
            ForeverUs is a beautiful app for couples to share memories, chat, and celebrate their love story together.
          </p>
          
          <a href="${invitationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; margin: 20px 0;">
            Accept Invitation ❤️
          </a>
          
          <p style="font-size: 14px; color: #999; margin: 30px 0 0 0;">
            Or copy this link: <br/>
            <code style="background-color: #e0e0e0; padding: 5px 10px; border-radius: 3px; word-break: break-all;">
              ${invitationLink}
            </code>
          </p>
          
          <p style="font-size: 12px; color: #999; margin: 20px 0 0 0;">
            This invitation expires in 24 hours.
          </p>
        </div>
        
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #999;">
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    // Store invitation in Firebase Firestore for real-time tracking
    await db.collection('invitations').doc(invitationToken).set({
      recipientEmail,
      senderName,
      invitationLink,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 3600000 * 24),
      status: 'pending',
    });

    // Try SendGrid first
    if (sendGridEnabled) {
      try {
        await sgMail.send({
          to: recipientEmail,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@foreverus.app',
          subject: `❤️ ${senderName} has invited you to ForeverUs!`,
          html: emailHtml,
        });
        console.log(`✅ Invitation email sent via SendGrid to ${recipientEmail}`);
        
        // Store in Firestore for audit trail
        await db.collection('email_logs').add({
          type: 'invitation',
          recipientEmail,
          senderName,
          method: 'sendgrid',
          status: 'sent',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          invitationToken,
        });
        return true;
      } catch (sendGridError: any) {
        console.error('❌ SendGrid error:', sendGridError.message);
        // Fall through to nodemailer
      }
    }

    // Try Nodemailer (SMTP or Ethereal)
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: process.env.SMTP_USER || process.env.SENDGRID_FROM_EMAIL || 'noreply@foreverus.app',
          to: recipientEmail,
          subject: `❤️ ${senderName} has invited you to ForeverUs!`,
          html: emailHtml,
        });
        console.log(`✅ Invitation email sent via SMTP to ${recipientEmail}. Message ID: ${info.messageId}`);
        
        // If using Ethereal, show preview URL
        if (info.response && info.response.includes('Ethereal')) {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          console.log(`📧 Email preview: ${previewUrl}`);
        }

        // Store in Firestore for audit trail
        await db.collection('email_logs').add({
          type: 'invitation',
          recipientEmail,
          senderName,
          method: transporter ? 'nodemailer' : 'ethereal',
          status: 'sent',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          invitationToken,
        });
        return true;
      } catch (sendError: any) {
        console.error('❌ Nodemailer error:', sendError.message);
        // Fall through to console logging
      }
    }

    // Fallback: Log to console
    console.log('\n✉️  INVITATION EMAIL (CONSOLE FALLBACK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${recipientEmail}`);
    console.log(`From: ${senderName}`);
    console.log(`Subject: ❤️ ${senderName} has invited you to ForeverUs!`);
    console.log(`\nInvitation Link:`);
    console.log(`${invitationLink}`);
    console.log(`\nThis invitation expires in 24 hours.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Store in Firestore for audit trail
    await db.collection('email_logs').add({
      type: 'invitation',
      recipientEmail,
      senderName,
      method: 'console',
      status: 'logged',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      invitationToken,
    });

    return true;
  } catch (error: any) {
    console.error('Failed to process invitation:', error.message);
    return false;
  }
};


export const sendPartnerConnectionEmail = async (
  recipientEmail: string,
  partnerName: string,
  clientUrl: string
): Promise<boolean> => {
  try {
    const db = admin.firestore();

    // Store connection confirmation in Firebase Firestore
    await db.collection('partner_connections').add({
      recipientEmail,
      partnerName,
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
    });

    // Send email if configured
    if (sendGridEnabled) {
      try {
        await sgMail.send({
          to: recipientEmail,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@foreverus.app',
          subject: `🎉 You're now connected with ${partnerName} on ForeverUs!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Connection Confirmed!</h1>
              </div>
              
              <div style="background-color: #f9f9f9; padding: 40px; text-align: center;">
                <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">
                  You're now connected with <strong>${partnerName}</strong> on ForeverUs!
                </p>
                
                <p style="font-size: 16px; color: #666; margin: 0 0 30px 0;">
                  Start sharing your love story together. Chat, create memories, and celebrate your journey.
                </p>
                
                <a href="${clientUrl}/chat" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; margin: 20px 0;">
                  Start Chatting 💬
                </a>
              </div>
              
              <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #999;">
                <p>Welcome to ForeverUs - Where Love Stories Begin!</p>
              </div>
            </div>
          `,
        });
        console.log(`✅ Connection email sent via SendGrid to ${recipientEmail}`);
        
        await db.collection('email_logs').add({
          type: 'partner_connection',
          recipientEmail,
          partnerName,
          method: 'sendgrid',
          status: 'sent',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      } catch (sendGridError: any) {
        console.error('❌ SendGrid error:', sendGridError.message);
      }
    }

    // Send email if configured
    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: process.env.SMTP_USER || process.env.SENDGRID_FROM_EMAIL || 'noreply@foreverus.app',
          to: recipientEmail,
          subject: `🎉 You're now connected with ${partnerName} on ForeverUs!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Connection Confirmed!</h1>
              </div>
              
              <div style="background-color: #f9f9f9; padding: 40px; text-align: center;">
                <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">
                  You're now connected with <strong>${partnerName}</strong> on ForeverUs!
                </p>
                
                <p style="font-size: 16px; color: #666; margin: 0 0 30px 0;">
                  Start sharing your love story together. Chat, create memories, and celebrate your journey.
                </p>
                
                <a href="${clientUrl}/chat" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; margin: 20px 0;">
                  Start Chatting 💬
                </a>
              </div>
              
              <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #999;">
                <p>Welcome to ForeverUs - Where Love Stories Begin!</p>
              </div>
            </div>
          `,
        });
        console.log(`✅ Connection email sent via SMTP to ${recipientEmail}. Message ID: ${info.messageId}`);
        
        if (info.response && info.response.includes('Ethereal')) {
          const previewUrl = nodemailer.getTestMessageUrl(info);
          console.log(`📧 Email preview: ${previewUrl}`);
        }

        await db.collection('email_logs').add({
          type: 'partner_connection',
          recipientEmail,
          partnerName,
          method: 'nodemailer',
          status: 'sent',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      } catch (sendError: any) {
        console.error('❌ Nodemailer error:', sendError.message);
      }
    }

    // Fallback: Log to console
    console.log('\n🎉 PARTNER CONNECTION CONFIRMATION (CONSOLE FALLBACK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${recipientEmail}`);
    console.log(`Subject: 🎉 You're now connected with ${partnerName} on ForeverUs!`);
    console.log(`\nMessage:\n`);
    console.log(`Congratulations! 💕`);
    console.log(`You're now connected with ${partnerName} on ForeverUs!`);
    console.log(`Start sharing your love story together.\n`);
    console.log(`Visit: ${clientUrl}/chat`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Store in Firestore audit trail
    await db.collection('email_logs').add({
      type: 'partner_connection',
      recipientEmail,
      partnerName,
      status: 'sent',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Connection confirmation tracked in Firebase for ${recipientEmail}`);
    return true;
  } catch (error: any) {
    console.error('Failed to process connection confirmation:', error.message);
    return false;
  }
};
