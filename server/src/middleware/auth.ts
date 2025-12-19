
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import User from '../models/user'; 

export interface AuthRequest extends Request {
  user?: any; 
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Auto-create user if doesn't exist - check if email exists first
      let existingUser = await User.findOne({ email: decodedToken.email });
      
      if (existingUser) {
        // User exists but with different firebaseUid, update it
        existingUser.firebaseUid = decodedToken.uid;
        user = await existingUser.save();
      } else {
        // Create new user
        user = new User({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
        });
        user = await user.save();
      }
    }
    
    req.user = user;
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

export const optionalProtect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      let user = await User.findOne({ firebaseUid: decodedToken.uid });
      if (!user) {
        // Auto-create user if doesn't exist - check if email exists first
        let existingUser = await User.findOne({ email: decodedToken.email });
        
        if (existingUser) {
          // User exists but with different firebaseUid, update it
          existingUser.firebaseUid = decodedToken.uid;
          user = await existingUser.save();
        } else {
          // Create new user
          user = new User({
            firebaseUid: decodedToken.uid,
            email: decodedToken.email || '',
            displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          });
          user = await user.save();
        }
      }
      if (user) {
        req.user = user;
      }
    } catch (error: any) {
      console.warn('Optional auth token failed to verify:', error.message);
    }
  }
  
  next();
};
