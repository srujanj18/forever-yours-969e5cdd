import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendInvitationEmail = async (
  partnerEmail: string,
  senderName: string,
  invitationToken: string,
  clientUrl: string
): Promise<void> => {
  const acceptLink = `${clientUrl}/accept-invitation?token=${invitationToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
        .heart { color: #e74c3c; font-size: 24px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
        .token-info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1><span class="heart">❤️</span> ForeverUs <span class="heart">❤️</span></h1>
          <p>A special invitation from your loved one</p>
        </div>
        <div class="content">
          <h2>Hello <span class="heart">💕</span></h2>
          <p><strong>${senderName}</strong> has invited you to join them on <strong>ForeverUs</strong> - a beautiful app to share memories, chat, and celebrate your love!</p>
          
          <p>Click the button below to accept the invitation:</p>
          
          <center>
            <a href="${acceptLink}" class="button">Accept Invitation</a>
          </center>
          
          <p>Or copy and paste this link in your browser:</p>
          <div class="token-info">
            <code style="word-break: break-all;">${acceptLink}</code>
          </div>
          
          <p><strong>Note:</strong> This invitation expires in 24 hours.</p>
          
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          
          <p>With love,<br><strong>ForeverUs Team</strong> <span class="heart">💝</span></p>
        </div>
        <div class="footer">
          <p>&copy; 2025 ForeverUs. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: partnerEmail,
    subject: `${senderName} invited you to ForeverUs 💕`,
    html: htmlContent,
  });
};
