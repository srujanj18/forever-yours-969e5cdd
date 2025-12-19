
import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/user';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { sendInvitationEmail, sendPartnerConnectionEmail } from '../services/emailService';
import { activeUsers } from '../services/socketService';
import fs from 'fs';
import path from 'path';

// @desc    Register a user
// @route   POST /api/auth/register
// @access  Private
export const registerUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);
    
    if (user) {
      return res.json({ user });
    }

    const firebaseUser = await admin.auth().getUser(req.user.firebaseUid);

    // Check if user with this email already exists
    let existingUser = await User.findOne({ email: firebaseUser.email });
    
    if (existingUser) {
      // Update existing user with firebaseUid if not set
      if (!existingUser.firebaseUid) {
        existingUser.firebaseUid = req.user.firebaseUid;
        await existingUser.save();
      }
      res.status(201).json({ user: existingUser });
    } else {
      // Create new user
      const newUser = new User({
        firebaseUid: req.user.firebaseUid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      });
      await newUser.save();
      res.status(201).json({ user: newUser });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Generate an invitation for a partner
// @route   POST /api/auth/generate-invitation
// @access  Private
export const generateInvitation = async (req: AuthRequest, res: Response) => {
  const { partnerEmail } = req.body;
  const currentUser = req.user;

  try {
    if (currentUser.partnerId) {
      return res.status(400).json({ error: 'You are already connected with a partner.' });
    }

    const partner = await User.findOne({ email: partnerEmail });

    if (partner) {
      // If partner exists and has also invited the current user, connect them instantly
      if (partner.invitationToken && partner.invitationToken.startsWith('INVITE-') && (await User.findOne({email: currentUser.email}))) {
        currentUser.partnerId = partner._id;
        partner.partnerId = currentUser._id;
        partner.invitationToken = undefined;
        partner.invitationExpires = undefined;
        
        await currentUser.save();
        await partner.save();

        return res.status(200).json({ 
          message: `You are now connected with ${partner.displayName}!`,
          partner: {
            _id: partner._id,
            displayName: partner.displayName,
            avatarUrl: partner.avatarUrl,
          }
        });
      }
    }

    // If partner doesn't exist or no mutual invitation, create a unique token
    const invitationToken = `INVITE-${crypto.randomBytes(20).toString('hex')}`;
    const invitationExpires = new Date(Date.now() + 3600000 * 24); // 24 hours

    currentUser.invitationToken = invitationToken;
    currentUser.invitationExpires = invitationExpires;
    await currentUser.save();

    // Send email to partner with invitation link
    try {
      await sendInvitationEmail(
        partnerEmail,
        currentUser.displayName,
        invitationToken,
        process.env.CLIENT_URL || 'http://localhost:5173'
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue even if email fails - the invitation is still created
    }

    res.status(200).json({ 
      message: `An invitation has been sent to ${partnerEmail}. They have 24 hours to accept.` 
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


// @desc    Google Sign In
// @route   POST /api/auth/google-signin
// @access  Private
export const googleSignIn = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);

    if (user) {
      return res.json({ user });
    }

    const firebaseUser = await admin.auth().getUser(req.user.firebaseUid);

    // Check if user with this email already exists
    let existingUser = await User.findOne({ email: firebaseUser.email });

    if (existingUser) {
      // Update existing user with firebaseUid if not set
      if (!existingUser.firebaseUid) {
        existingUser.firebaseUid = req.user.firebaseUid;
        // Update display name and avatar from Google if not set
        if (!existingUser.displayName && firebaseUser.displayName) {
          existingUser.displayName = firebaseUser.displayName;
        }
        if (!existingUser.avatarUrl && firebaseUser.photoURL) {
          existingUser.avatarUrl = firebaseUser.photoURL;
        }
        await existingUser.save();
      }
      res.status(201).json({ user: existingUser });
    } else {
      // Create new user with Google data
      const newUser = new User({
        firebaseUid: req.user.firebaseUid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        avatarUrl: firebaseUser.photoURL || undefined,
      });
      await newUser.save();
      res.status(201).json({ user: newUser });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { displayName } = req.body;

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update display name
    user.displayName = displayName.trim();
    await user.save();

    // Return updated user with populated partner data
    const updatedUser = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl');

    res.json({
      user: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Accept an invitation
// @route   POST /api/auth/accept-invitation
// @access  Private
export const acceptInvitation = async (req: AuthRequest, res: Response) => {
    const { invitationToken } = req.body;

    // If no user authenticated, reject
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const currentUser = req.user;

    try {
      if (currentUser.partnerId) {
        return res.status(400).json({ error: 'You are already connected with a partner.' });
      }

      const invitingUser = await User.findOne({
        invitationToken: invitationToken,
        invitationExpires: { $gt: new Date() },
      });

      if (!invitingUser) {
        return res.status(400).json({ message: 'Invalid or expired invitation token.' });
      }

      // Connect users
      currentUser.partnerId = invitingUser._id;
      invitingUser.partnerId = currentUser._id;

      // Clear invitation token
      invitingUser.invitationToken = undefined;
      invitingUser.invitationExpires = undefined;

      await currentUser.save();
      await invitingUser.save();

      // Send connection confirmation emails
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      try {
        await sendPartnerConnectionEmail(invitingUser.email, currentUser.displayName, clientUrl);
        await sendPartnerConnectionEmail(currentUser.email, invitingUser.displayName, clientUrl);
      } catch (emailError) {
        console.error('Failed to send confirmation emails:', emailError);
        // Continue even if email fails
      }

      res.status(200).json({
        success: true,
        message: `You are now connected with ${invitingUser.displayName}!`,
        partner: {
          _id: invitingUser._id,
          displayName: invitingUser.displayName,
          avatarUrl: invitingUser.avatarUrl,
        }
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  
// @desc    Upload user avatar
// @route   POST /api/auth/upload-avatar
// @access  Private
export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // If user already has an avatar, delete the old one from the server
    if (user.avatarUrl) {
      const oldAvatarPath = path.join(process.cwd(), 'public', user.avatarUrl);
      // Check if the file exists and it is not a google photo url
      if (fs.existsSync(oldAvatarPath) && !user.avatarUrl.startsWith('http')) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // The path will be relative to the 'public' folder
    const avatarUrl = `/uploads/${req.file.filename}`;
    user.avatarUrl = avatarUrl;
    await user.save();

    // Return updated user with populated partner data
    const updatedUser = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl') as any;

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found after update' });
    }

    // Emit socket event to notify partner of avatar change
    if (updatedUser.partnerId) {
      const io = require('../services/socketService').getIO();
      const partnerSocketId = activeUsers.get(updatedUser.partnerId._id.toString());
      if (partnerSocketId) {
        io.to(partnerSocketId).emit('partner-avatar-updated', {
          userId: updatedUser._id,
          avatarUrl: updatedUser.avatarUrl
        });
      }
    }

    res.json({
      user: updatedUser,
      message: 'Avatar uploaded successfully'
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update partner's display name
// @route   PUT /api/auth/partner-profile
// @access  Private
export const updatePartnerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { displayName } = req.body;

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'No partner connected' });
    }

    // Update partner's display name
    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    partner.displayName = displayName.trim();
    await partner.save();

    // Return updated user with populated partner data
    const updatedUser = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl');

    res.json({
      user: updatedUser,
      message: 'Partner profile updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update custom partner name
// @route   PUT /api/auth/custom-partner-name
// @access  Private
export const updateCustomPartnerName = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { customPartnerName } = req.body;

    if (!customPartnerName || customPartnerName.trim().length === 0) {
      return res.status(400).json({ error: 'Custom partner name is required' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'No partner connected' });
    }

    // Update custom partner name for this user only
    user.customPartnerName = customPartnerName.trim();
    await user.save();

    // Return updated user with populated partner data
    const updatedUser = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl');

    res.json({
      user: updatedUser,
      message: 'Custom partner name updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Remove user avatar
// @route   DELETE /api/auth/remove-avatar
// @access  Private
export const removeAvatar = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has an avatar, delete it from the server
    if (user.avatarUrl) {
      const avatarPath = path.join(process.cwd(), 'public', user.avatarUrl);
      // Check if the file exists and it is not a google photo url
      if (fs.existsSync(avatarPath) && !user.avatarUrl.startsWith('http')) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Remove avatar URL from user
    user.avatarUrl = undefined;
    await user.save();

    // Return updated user with populated partner data
    const updatedUser = await User.findById(req.user._id).populate('partnerId', 'displayName avatarUrl');

    res.json({
      user: updatedUser,
      message: 'Avatar removed successfully'
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
