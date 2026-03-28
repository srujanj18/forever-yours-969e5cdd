
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  Persistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  UserCredential,
} from 'firebase/auth';

import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCmoQbv1l_f2qjtL1eZjqZMWRn8xzdGh-8',
  authDomain: 'foreverus-84c1d.firebaseapp.com',
  projectId: 'foreverus-84c1d',
  storageBucket: 'foreverus-84c1d.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);

function getExpoPersistence(storage: typeof ReactNativeAsyncStorage): Persistence {
  return class {
    static type = 'LOCAL' as const;
    readonly type = 'LOCAL' as const;

    async _isAvailable() {
      try {
        await storage.setItem('__firebase_async_storage_available', '1');
        await storage.removeItem('__firebase_async_storage_available');
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const json = await storage.getItem(key);
      return json ? (JSON.parse(json) as T) : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {}

    _removeListener() {}
  };
}

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getExpoPersistence(ReactNativeAsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  return credential;
}

export async function signOutUser() {
  return signOut(auth);
}

export default app;
