
import express, { Request } from 'express';
import { getProfile, generateInvitation, acceptInvitation, registerUser, googleSignIn, updateProfile, uploadAvatar as uploadAvatarController, removeAvatar, updatePartnerProfile, updateCustomPartnerName } from '../controllers/auth';
import { protect, optionalProtect } from '../middleware/auth';
import { createRateLimit, validateAuthInput, validateCustomPartnerNameInput, validateFileUpload } from '../middleware/security';
import multer, { StorageEngine } from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for avatar uploads
const avatarStorage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, accept?: boolean) => void) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for avatars
});

// Rate limiting for auth endpoints
const authRateLimit = createRateLimit(15 * 60 * 1000, 10); // 10 requests per 15 minutes
const strictRateLimit = createRateLimit(60 * 1000, 5); // 5 requests per minute for sensitive operations

router.post('/register', authRateLimit, protect, registerUser);
router.post('/google-signin', authRateLimit, protect, googleSignIn);
router.put('/profile', authRateLimit, protect, validateAuthInput, updateProfile);
router.put('/custom-partner-name', authRateLimit, protect, validateCustomPartnerNameInput, updateCustomPartnerName);
router.get('/profile', protect, getProfile);
router.post('/generate-invitation', strictRateLimit, protect, validateAuthInput, generateInvitation);
router.post('/accept-invitation', authRateLimit, optionalProtect, acceptInvitation);
router.post('/upload-avatar', authRateLimit, protect, validateFileUpload, uploadAvatar.single('avatar'), uploadAvatarController);

export default router;
