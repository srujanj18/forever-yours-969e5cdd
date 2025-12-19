# ForeverYours - A Couple's Memory App 💕

## Overview
ForeverYours is a beautiful web application that lets couples share memories, chat, and keep their love story together. Built with modern web technologies including React, Express.js, MongoDB, and Firebase.

## ⚠️ Important: Updated Architecture!

**This project has been completely refactored!**
- ✅ Removed Supabase completely
- ✅ Added Express.js backend
- ✅ MongoDB for data storage
- ✅ Firebase for authentication
- ✅ Nodemailer for emails

## ✨ Features
- **🔐 Secure Authentication** - Firebase-backed user accounts
- **💬 Real-time Chat** - Message your partner instantly
- **📸 Photo Gallery** - Share memories with beautiful photo uploads
- **📅 Timeline** - Document special moments together
- **💌 Invitations** - Connect with your partner via email invitations
- **🔒 Private & Secure** - All data encrypted and stored safely

## 🚀 Quick Start

### Prerequisites
- Node.js & npm installed
- MongoDB running locally (or use MongoDB Atlas)
- Firebase project created

### Step 1: Start Backend
```bash
cd server
npm install  # if not already done
npm run dev
```
Wait for: `Server is running on http://localhost:5000`

### Step 2: Start Frontend
```bash
npm install  # if not already done
npm run dev
```
Wait for: `Local: http://localhost:5173`

### Step 3: Open Application
Visit http://localhost:5173 and start using!

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **QUICKSTART.md** | 3-step setup guide (START HERE!) |
| **PROJECT_COMPLETE.md** | Comprehensive integration summary |
| **EMAIL_SETUP.md** | How to enable email invitations |
| **INTEGRATION_COMPLETE.md** | Architecture & design details |
| **VERIFICATION_CHECKLIST.md** | Verify everything is working |

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/261c2600-2bdc-4789-8b9e-f9da9ec85848) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
