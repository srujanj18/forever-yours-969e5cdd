# Togetherly

Togetherly is a relationship-focused full-stack project with:

- a web frontend in the repo root
- a mobile app in [`mobile-app`](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app)
- an Express + MongoDB backend in [`server`](c:/Users/sruja/Documents/forever-yours-969e5cdd/server)

The system supports authentication, partner invitations, real-time chat, photo/video sharing, voice notes, moments, goals, gallery uploads, and call signaling.

## Monorepo Layout

```text
.
├─ src/                  Web frontend source
├─ mobile-app/           Expo / React Native mobile app
├─ server/               Express API + Socket.IO + MongoDB
├─ public/               Web frontend public assets
├─ google-services.json  Android Firebase config for mobile
└─ foreverus-*.json      Firebase service account for backend
```

## Stack

## Frontend Web

- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI / shadcn-style components
- Socket.IO client
- Firebase Web SDK

## Mobile App

- Expo SDK 51
- React Native
- Expo Router
- Firebase Auth
- Expo AV for voice notes
- Expo Image Picker
- Expo Image Manipulator
- Socket.IO client

## Backend

- Node.js
- Express
- TypeScript
- MongoDB with Mongoose
- Socket.IO
- Firebase Admin SDK
- Multer
- Nodemailer / SendGrid support

## Core Services

- Firebase Authentication for sign-in identity
- MongoDB for app data
- Local server uploads for media/voice note file hosting
- Android Emulator support through Expo

## Applications

## 1. Web Frontend

Location: [`src`](c:/Users/sruja/Documents/forever-yours-969e5cdd/src)

The root app is the browser version of Togetherly. It talks to the same backend as the mobile app and uses Firebase for auth.

Main responsibilities:

- authentication screens
- browser chat UI
- gallery, moments, goals
- invitation flows
- browser-based API consumption

Run it with:

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

## 2. Mobile App

Location: [`mobile-app`](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app)

The mobile app is built with Expo and Expo Router. It mirrors the main app features for Android and can also run on iOS/web through Expo.

Main responsibilities:

- Firebase-authenticated mobile session
- chat UI
- media picker and preview flow
- voice note recording and playback
- gallery, goals, moments, profile, call UI
- Android Emulator support

Run it with:

```bash
cd mobile-app
npm install
npx expo start
```

Useful commands:

```bash
npx expo start
npx expo start --android
npx expo start --ios
npx expo start --web
```

## 3. Backend API

Location: [`server`](c:/Users/sruja/Documents/forever-yours-969e5cdd/server)

The backend handles:

- Firebase token verification
- MongoDB persistence
- partner invitations
- chat message CRUD
- media upload endpoints
- voice note storage
- real-time presence / typing / call signaling

Run it with:

```bash
cd server
npm install
npm run dev
```

Build production output:

```bash
npm run build
npm start
```

Default local API URL:

```text
http://localhost:5000/api
```

## How the Pieces Connect

## Authentication Flow

### Mobile and Web

Both clients use Firebase Authentication.

- client signs in with Firebase
- client gets Firebase ID token
- every API request includes `Authorization: Bearer <token>`
- backend verifies the token in auth middleware
- backend loads the matching user from MongoDB

Relevant files:

- [mobile-app/lib/firebase.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/firebase.ts)
- [mobile-app/lib/api.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/api.ts)
- [server/src/config/firebase.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/config/firebase.ts)
- [server/src/middleware/auth.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/middleware/auth.ts)

## API Flow

The mobile app and web frontend both call the Express backend.

On mobile:

- base URL comes from `EXPO_PUBLIC_API_URL` if set
- otherwise Android emulator uses `http://10.0.2.2:5000/api`
- otherwise local default is `http://localhost:5000/api`

Relevant file:

- [mobile-app/lib/api.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/api.ts)

Why `10.0.2.2` matters:

- Android emulators cannot use the host machine through plain `localhost`
- `10.0.2.2` is the emulator alias for your host computer
- this is why the mobile app can talk to the local Express server while running in Android Studio

## Real-Time Socket Flow

Socket.IO is used for:

- presence
- partner online/offline updates
- typing indicators
- call signaling

Server side:

- users register their socket after login
- active user map is maintained in memory
- partner status events are emitted automatically
- call offer/answer/ICE events are routed to the partner socket

Relevant file:

- [server/src/services/socketService.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/services/socketService.ts)

Mobile app state handling:

- [mobile-app/lib/app-state.tsx](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/app-state.tsx)

## Database Model

MongoDB is the main application database.

Examples of stored domain data:

- users
- messages
- media metadata
- moments
- goals
- call history

Connection file:

- [server/src/config/db.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/config/db.ts)

## Media and Voice Note Flow

### Photo / Video

For general media:

- user picks media in chat or gallery
- mobile app uploads file to backend
- backend stores file metadata in MongoDB
- clients render the returned `mediaUrl`

### Voice Notes

Voice notes use a dedicated flow:

- user records a voice note in mobile chat
- mobile app reads the recorded file as base64
- app posts it to `POST /api/messages/audio`
- backend saves the audio file into `server/public/uploads`
- backend creates a message document with `mediaUrl` and `mediaType`
- chat renders a voice note bubble and plays it using Expo AV

Relevant files:

- [mobile-app/app/chat.tsx](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/app/chat.tsx)
- [mobile-app/lib/app-state.tsx](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/app-state.tsx)
- [server/src/controllers/messages.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/controllers/messages.ts)

## Main User Flows

## 1. Sign Up / Sign In

1. User signs up or signs in with Firebase.
2. App receives Firebase auth session.
3. Backend profile is created/loaded in MongoDB.
4. App loads profile, messages, gallery, moments, goals, and calls.

## 2. Partner Invitation

1. User enters partner email.
2. Backend generates and sends invitation.
3. Invited user accepts via token route.
4. Backend links both users as partners.

## 3. Chat Messaging

1. User types a message.
2. Mobile/web client sends to `/api/messages`.
3. Message is stored in MongoDB.
4. Thread refreshes and auto-scrolls to bottom.

## 4. Media Sharing

1. User chooses image/video.
2. Mobile app opens preview/edit modal.
3. User can rotate/mirror/reset images.
4. User adds optional caption.
5. Media is uploaded and message is created.

## 5. Voice Notes

1. User taps the mic button.
2. Expo AV records audio.
3. Recording is stopped and converted to base64.
4. App sends to `/api/messages/audio`.
5. Backend saves file and creates message.
6. Partner can play the note from chat.

## 6. Presence and Typing

1. Socket connects after profile loads.
2. Client registers current user ID.
3. Partner status is emitted.
4. Typing start/stop events update chat header state.

## 7. Calls

Call UI exists in the mobile app and signaling flows through Socket.IO.

Current backend responsibilities:

- initiate call
- accept/reject
- exchange signaling data
- update call history

Relevant file:

- [server/src/services/socketService.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/services/socketService.ts)

## Environment Configuration

## Root Web App

Uses the root `.env` / Vite environment if configured.

## Server

Important variables in [`server/.env`](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/.env):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/forever-yours
CLIENT_URL=http://localhost:5173
GOOGLE_APPLICATION_CREDENTIALS=../foreverus-84c1d-bb951f91766d.json
FIREBASE_STORAGE_BUCKET=foreverus-84c1d.appspot.com
```

Notes:

- `GOOGLE_APPLICATION_CREDENTIALS` points to the Firebase Admin service account JSON
- `MONGO_URI` points to the MongoDB database
- `CLIENT_URL` is used for CORS / web origin allowance

## Mobile App

Optional Expo env:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
```

If omitted, the app already falls back to:

- Android emulator: `http://10.0.2.2:5000/api`
- others: `http://localhost:5000/api`

## Android Studio Connection

The mobile app is not a native Android Studio Gradle project. It runs through Expo, but Android Studio is still used for the Android emulator.

### How it works

1. Start the backend server.
2. Start Expo in `mobile-app`.
3. Open Android Studio.
4. Launch an Android Virtual Device.
5. Expo connects to the emulator and opens the app.

### Typical setup

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd mobile-app
npx expo start --android
```

### Important emulator networking rule

When the mobile app runs inside Android Studio’s emulator:

- `localhost` means the emulator itself
- your Node/Express server is on your host machine
- therefore the app must call `10.0.2.2`

This is already handled in:

- [mobile-app/lib/api.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/api.ts)

### Required Android-related files

- [google-services.json](c:/Users/sruja/Documents/forever-yours-969e5cdd/google-services.json)
- Expo project config inside [`mobile-app/app.json`](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/app.json)

## Scripts

## Root

```bash
npm run dev
npm run build
npm run preview
```

## Server

```bash
cd server
npm run dev
npm run build
npm start
```

## Mobile

```bash
cd mobile-app
npx expo start
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Development Checklist

1. Start MongoDB.
2. Start backend in [`server`](c:/Users/sruja/Documents/forever-yours-969e5cdd/server).
3. Start web app from repo root if working on browser UI.
4. Start Expo from [`mobile-app`](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app) if working on mobile.
5. If using Android Studio, boot emulator before or while Expo is running.
6. Make sure Firebase service account JSON exists at the configured path.

## Troubleshooting

## Mobile app cannot reach backend

Check:

- backend is running on port `5000`
- Android emulator is using `10.0.2.2`
- `EXPO_PUBLIC_API_URL` is correct if overridden

## Firebase Admin fails on server start

Check:

- `GOOGLE_APPLICATION_CREDENTIALS` path is valid
- service account JSON exists
- JSON belongs to the intended Firebase project

## Voice notes send but do not play

Check:

- backend wrote the file into `server/public/uploads`
- `mediaUrl` returned in the message starts with `/uploads/`
- server is serving static files from `/uploads`
- app can reach the backend host from the device/emulator

## Socket events seem missing

Check:

- backend started successfully with Socket.IO initialized
- user is authenticated and profile is loaded
- client connected to `SOCKET_URL`

## Key Files

- [README.md](c:/Users/sruja/Documents/forever-yours-969e5cdd/README.md)
- [mobile-app/app/chat.tsx](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/app/chat.tsx)
- [mobile-app/lib/api.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/api.ts)
- [mobile-app/lib/app-state.tsx](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/app-state.tsx)
- [mobile-app/lib/firebase.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/mobile-app/lib/firebase.ts)
- [server/src/index.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/index.ts)
- [server/src/config/db.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/config/db.ts)
- [server/src/config/firebase.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/config/firebase.ts)
- [server/src/services/socketService.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/services/socketService.ts)
- [server/src/controllers/messages.ts](c:/Users/sruja/Documents/forever-yours-969e5cdd/server/src/controllers/messages.ts)

## Summary

Togetherly is a shared-codebase relationship app with:

- web frontend at the repo root
- Expo mobile frontend in `mobile-app`
- Express + MongoDB backend in `server`
- Firebase-based authentication
- Socket.IO for real-time behavior
- local media hosting for uploads and voice notes
- Android Studio emulator support through Expo

It is designed so the same backend powers both web and mobile experiences while keeping auth, chat, media, and partner flows consistent across both clients.
