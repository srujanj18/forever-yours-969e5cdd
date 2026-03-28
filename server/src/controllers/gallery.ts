import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Media from '../models/media';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { getFirebaseStorageBucketCandidates } from '../config/firebase';

async function uploadFileToFirebaseStorage(localFilePath: string, fileName: string, mimeType: string) {
  const bucketCandidates = getFirebaseStorageBucketCandidates();
  let lastError: unknown;

  for (const bucketName of bucketCandidates) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const remotePath = `chat-media/${Date.now()}-${fileName}`;

      await bucket.upload(localFilePath, {
        destination: remotePath,
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      const [signedUrl] = await bucket.file(remotePath).getSignedUrl({
        action: 'read',
        expires: '03-01-2500',
      });

      return signedUrl;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No Firebase Storage bucket is configured.');
}

// @desc    Get all media for partners
// @route   GET /api/gallery
// @access  Private
export const getMedia = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user.partnerId) {
      return res.status(200).json({ media: [] });
    }

    const media = await Media.find({
      $or: [
        { senderId: user._id, recipientId: user.partnerId },
        { senderId: user.partnerId, recipientId: user._id },
      ],
      deletedBy: { $ne: user._id },
    })
    .sort({ createdAt: -1 });

    res.json({ media });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Upload media
// @route   POST /api/gallery/upload
// @access  Private
export const uploadMedia = async (req: AuthRequest, res: Response) => {
  const user = req.user;

  try {
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    const { caption } = req.body;
    const localFilePath = path.join(process.cwd(), 'public', 'uploads', req.file.filename);
    const mediaUrl = await uploadFileToFirebaseStorage(localFilePath, req.file.filename, req.file.mimetype);

    const media = new Media({
      senderId: user._id,
      recipientId: user.partnerId,
      mediaUrl,
      mediaType: req.file.mimetype,
      caption: caption || undefined,
    });

    await media.save();
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    res.status(201).json(media);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete media
// @route   DELETE /api/gallery/:id
// @access  Private
export const deleteMedia = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const media = await Media.findById(id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // Check if user is either sender or recipient
    if (media.senderId.toString() !== user._id.toString() && media.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this media.' });
    }

    // Add user to deletedBy array if not already present
    if (!media.deletedBy.includes(user._id)) {
      media.deletedBy.push(user._id);
      await media.save();
    }

    // If both users have deleted it, delete the file and document
    if (media.deletedBy.length >= 2) {
      // Delete file from disk
      const filePath = path.join(process.cwd(), 'public', media.mediaUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await Media.findByIdAndDelete(id);
    }

    res.json({ message: 'Media deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
