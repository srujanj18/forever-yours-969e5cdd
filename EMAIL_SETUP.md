# Email Setup Guide for ForeverYours

## Setting Up Gmail for Sending Invitation Emails

To enable real-time invitation emails, follow these steps:

### Step 1: Enable 2-Factor Authentication
1. Go to your [Google Account](https://myaccount.google.com/)
2. Click "Security" in the left sidebar
3. Scroll down to "2-Step Verification" and enable it
4. Follow the prompts and verify your phone number

### Step 2: Generate an App Password
1. Go to [Google Account Security](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. Copy this password

### Step 3: Update .env File
Open `server/.env` and update:
```dotenv
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

Replace `your-email@gmail.com` with your Gmail address and the password with the 16-character app password (without spaces when used in code, spaces are just for readability).

### Step 4: Restart the Server
```bash
cd server
npm run dev
```

You should see:
```
Email service initialized successfully
Server is running on http://localhost:5000
```

## Testing the Email Service

1. Go to the Chat page on the frontend
2. Enter your partner's email address
3. Click "Send Invitation"
4. Check the partner's email inbox (or spam folder) for the invitation

## Fallback Behavior

If email sending is not configured:
- Invitations will be logged to the console with a link
- The system will still work, but emails won't be sent
- Check the server console for the invitation link and token

## Alternative Email Services

You can also use other email services by modifying `server/src/services/emailService.ts`:

### Using SendGrid
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
```

### Using AWS SES
```typescript
import AWS from 'aws-sdk';
const ses = new AWS.SES({ region: process.env.AWS_REGION });
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Username and Password not accepted" | Ensure you're using an App Password, not your regular Gmail password |
| "Less secure app access" error | You must use an App Password with 2FA enabled |
| Emails not arriving | Check spam/junk folder; Gmail may flag unfamiliar services |
| "Invalid login" | Verify EMAIL_USER and EMAIL_PASSWORD are correctly set in .env |
