import admin from 'firebase-admin';

let storageBucketCandidates: string[] = [];

export const getFirebaseStorageBucketCandidates = () => storageBucketCandidates;

export const initFirebase = () => {
  try {
    const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credential) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
    }

    let serviceAccount;

    // ✅ Check if it's JSON string (Render) or file path (local)
    if (credential.trim().startsWith('{')) {
      // 🔥 Production (Render)
      serviceAccount = JSON.parse(credential);
    } else {
      // 🧪 Local development (file path)
      const fs = require('fs');
      const path = require('path');

      const absolutePath = path.isAbsolute(credential)
        ? credential
        : path.join(process.cwd(), credential);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Firebase credentials file not found at: ${absolutePath}`);
      }

      serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }

    // ✅ Storage bucket setup
    storageBucketCandidates = [
      process.env.FIREBASE_STORAGE_BUCKET,
      serviceAccount.storageBucket,
      serviceAccount.project_id
        ? `${serviceAccount.project_id}.appspot.com`
        : undefined,
      serviceAccount.project_id
        ? `${serviceAccount.project_id}.firebasestorage.app`
        : undefined,
    ].filter((value): value is string => !!value);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucketCandidates[0],
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    process.exit(1);
  }
};