import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCmoQbv1l_f2qjtL1eZjqZMWRn8xzdGh-8",
  authDomain: "foreverus-84c1d.firebaseapp.com",
  projectId: "foreverus-84c1d",
  storageBucket: "foreverus-84c1d.firebasestorage.app",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Use session persistence so auth is not shared across tabs/windows
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.warn('Failed to set session persistence:', error);
});

export default app;
