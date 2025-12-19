
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

export const initFirebase = () => {
  try {
    const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
    }
    
    const absolutePath = path.isAbsolute(credentialPath) 
      ? credentialPath 
      : path.join(process.cwd(), credentialPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Firebase credentials file not found at: ${absolutePath}`);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
    process.exit(1);
  }
};
