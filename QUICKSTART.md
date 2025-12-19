# 🚀 Quick Start Guide - ForeverYours

## In 3 Steps:

### Step 1: Start Backend
```bash
cd server
npm run dev
```
✓ Wait for: `Server is running on http://localhost:5000`

### Step 2: Start Frontend (New Terminal)
```bash
npm run dev
```
✓ Wait for: `Local: http://localhost:5173`

### Step 3: Visit Application
- Open http://localhost:5173
- Sign up with any email
- Invite your partner
- Start sharing! 💕

---

## What's Working Now?

| Feature | Status | How to Test |
|---------|--------|------------|
| User Registration | ✅ | Sign up on `/auth` page |
| Partner Invitations | ✅ | Chat page → "Send Invitation" |
| Chat Messaging | ✅ | Chat page → type & send message |
| Photo Gallery | ✅ | Gallery page → Upload button |
| Moments Timeline | ✅ | Moments page → Add Moment button |
| Email Alerts | ⚠️ | See EMAIL_SETUP.md for Gmail config |

---

## Enable Email Invitations (Optional)

```bash
# 1. Get Gmail App Password from https://myaccount.google.com/apppasswords
# 2. Edit server/.env:
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# 3. Restart server
npm run dev
```

More details in `EMAIL_SETUP.md`

---

## File Locations

| File | Purpose |
|------|---------|
| `SETUP_COMPLETE.md` | Full integration details |
| `EMAIL_SETUP.md` | How to enable Gmail emails |
| `INTEGRATION_COMPLETE.md` | Architecture overview |
| `server/.env` | Backend configuration |
| `.env` | Frontend configuration |

---

## Backend API (Quick Reference)

```bash
# Health Check
curl http://localhost:5000/api

# All endpoints require Firebase token in header:
# Authorization: Bearer <firebase-token>

# Get User Profile
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/auth/profile

# Send Message
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello!"}' \
  http://localhost:5000/api/messages
```

---

## Verify Everything Works

✅ Backend running?
```bash
curl http://localhost:5000/api
# Should see: Welcome to the Forever Yours API! ❤️
```

✅ Frontend running?
```
Visit http://localhost:5173
# Should see: ForeverUs login page
```

✅ MongoDB connected?
```
Check server terminal output
# Should see: MongoDB connected successfully
```

---

## Stuck? Check These:

1. **Server won't start?**
   - Port 5000 in use: `Get-Process node | Stop-Process -Force`
   - MongoDB not running: Start MongoDB

2. **API returning 401?**
   - Frontend not sending auth token
   - Firebase token invalid
   - Check console for errors

3. **Emails not sending?**
   - Email not configured (expected in dev)
   - Check `EMAIL_SETUP.md`
   - Emails logged to console instead

---

## Database

MongoDB is storing:
- 👤 User profiles
- 💬 Chat messages
- 📸 Gallery photos
- 📅 Timeline moments

Local DB: `mongodb://localhost:27017/forever-yours`

---

## That's It! 🎉

Your ForeverYours app is **ready to use**. 

Create an account, invite your partner, and start making memories together! 💕

For production deployment, see `INTEGRATION_COMPLETE.md`
