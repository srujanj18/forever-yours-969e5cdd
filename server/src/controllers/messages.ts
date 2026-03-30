
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import Message from '../models/message';
import path from 'path';
import User from '../models/user';
import { getIO } from '../services/socketService';

function saveBufferToLocalUploads(buffer: Buffer, fileName: string) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeName = `${Date.now()}-${fileName.replace(/[^\w.-]/g, '_')}`;
  const localFilePath = path.join(uploadsDir, safeName);
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/${safeName}`;
}

async function getPopulatedMessage(messageId: string) {
  return Message.findById(messageId)
    .populate('senderId', 'displayName avatarUrl')
    .populate('recipientId', 'displayName avatarUrl')
    .populate('reactions.userId', 'displayName avatarUrl')
    .populate({
      path: 'replyTo',
      populate: {
        path: 'senderId',
        select: 'displayName avatarUrl'
      }
    })
    .populate({
      path: 'forwardedFrom',
      populate: {
        path: 'senderId',
        select: 'displayName avatarUrl'
      }
    });
}

function emitToUser(userId: string, event: string, payload: unknown) {
  getIO().to(`user-${userId}`).emit(event, payload);
}

// @desc    Get all messages between partners
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner.' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: user._id, recipientId: user.partnerId },
        { senderId: user.partnerId, recipientId: user._id },
      ],
      deletedBy: { $ne: user._id },
    })
    .populate('senderId', 'displayName avatarUrl')
    .populate('recipientId', 'displayName avatarUrl')
    .populate({
      path: 'replyTo',
      populate: {
        path: 'senderId',
        select: 'displayName avatarUrl'
      }
    })
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Send a message to the partner
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req: AuthRequest, res: Response) => {
  const { content, mediaUrl, mediaType, replyTo, clientTempId } = req.body;
  const user = req.user;

  try {
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner to send messages.' });
    }

    const message = new Message({
      senderId: user._id,
      recipientId: user.partnerId,
      content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      replyTo: replyTo || null,
    });

    await message.save();

    // Populate sender details and replyTo for the response
    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(user.partnerId), 'message:new', populatedMessage);
      emitToUser(String(user._id), 'message:sent', { clientTempId, message: populatedMessage });
    }

    res.status(201).json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Send a voice message to the partner
// @route   POST /api/messages/audio
// @access  Private
export const sendVoiceMessage = async (req: AuthRequest, res: Response) => {
  const { audioBase64, mimeType, fileName, replyTo, clientTempId } = req.body;
  const user = req.user;

  try {
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner to send messages.' });
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'No audio payload provided.' });
    }

    const normalizedMimeType =
      typeof mimeType === 'string' && mimeType.startsWith('audio/')
        ? mimeType
        : 'audio/m4a';
    const normalizedFileName =
      typeof fileName === 'string' && fileName.trim()
        ? fileName.trim()
        : `voice-note-${Date.now()}.m4a`;
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const mediaUrl = saveBufferToLocalUploads(audioBuffer, normalizedFileName);

    const message = new Message({
      senderId: user._id,
      recipientId: user.partnerId,
      content: '',
      mediaUrl,
      mediaType: normalizedMimeType,
      messageType: 'voice',
      replyTo: replyTo || null,
    });

    await message.save();

    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(message.senderId), 'message:update', populatedMessage);
      emitToUser(String(message.recipientId), 'message:update', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message || error });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Private
export const editMessage = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.senderId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    // Populate sender details and replyTo for the response
    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(message.senderId), 'message:update', populatedMessage);
      emitToUser(String(message.recipientId), 'message:update', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete message for everyone
// @route   DELETE /api/messages/:id/delete-for-everyone
// @access  Private
export const deleteMessageForEveryone = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.senderId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    message.content = 'This message has been deleted';
    message.isDeleted = true;
    await message.save();

    // Populate sender details and replyTo for the response
    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(message.senderId), 'message:update', populatedMessage);
      emitToUser(String(message.recipientId), 'message:update', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete message for me
// @route   DELETE /api/messages/:id/delete-for-me
// @access  Private
export const deleteMessageForMe = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is sender or recipient
    if (message.senderId.toString() !== user._id.toString() && message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete messages in your conversation.' });
    }

    if (!message.deletedBy) {
      message.deletedBy = [];
    }

    if (!message.deletedBy.includes(user._id)) {
      message.deletedBy.push(user._id);
    }

    await message.save();
    emitToUser(String(user._id), 'message:delete', { messageId: id });

    res.json({ message: 'Message deleted for you.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add reaction to message
// @route   POST /api/messages/:id/reactions
// @access  Private
export const addReaction = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (message.senderId.toString() !== user._id.toString() && message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only react to messages in your conversation.' });
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(reaction => reaction.userId.toString() !== user._id.toString());

    // Add new reaction
    message.reactions.push({
      userId: user._id,
      emoji,
      createdAt: new Date(),
    });

    await message.save();

    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(message.senderId), 'message:update', populatedMessage);
      emitToUser(String(message.recipientId), 'message:update', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Remove reaction from message
// @route   DELETE /api/messages/:id/reactions
// @access  Private
export const removeReaction = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (message.senderId.toString() !== user._id.toString() && message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only remove reactions from messages in your conversation.' });
    }

    if (message.reactions) {
      message.reactions = message.reactions.filter(reaction => reaction.userId.toString() !== user._id.toString());
    }

    await message.save();

    const populatedMessage = await getPopulatedMessage(String(message._id));

    if (populatedMessage) {
      emitToUser(String(message.senderId), 'message:update', populatedMessage);
      emitToUser(String(message.recipientId), 'message:update', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Forward message
// @route   POST /api/messages/:id/forward
// @access  Private
export const forwardMessage = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const originalMessage = await Message.findById(id);

    if (!originalMessage) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (originalMessage.senderId.toString() !== user._id.toString() && originalMessage.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only forward messages from your conversation.' });
    }

    if (!user.partnerId) {
      return res.status(400).json({ error: 'You need a partner to forward messages.' });
    }

    const forwardedMessage = new Message({
      senderId: user._id,
      recipientId: user.partnerId,
      content: originalMessage.content,
      mediaUrl: originalMessage.mediaUrl,
      mediaType: originalMessage.mediaType,
      messageType: originalMessage.messageType,
      forwardedFrom: originalMessage._id,
    });

    await forwardedMessage.save();

    const populatedMessage = await Message.findById(forwardedMessage._id)
      .populate('senderId', 'displayName avatarUrl')
      .populate('recipientId', 'displayName avatarUrl')
      .populate({
        path: 'forwardedFrom',
        populate: {
          path: 'senderId',
          select: 'displayName avatarUrl'
        }
      });

    res.status(201).json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Pin message
// @route   PUT /api/messages/:id/pin
// @access  Private
export const pinMessage = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (message.senderId.toString() !== user._id.toString() && message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only pin messages in your conversation.' });
    }

    message.isPinned = true;
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'displayName avatarUrl')
      .populate('recipientId', 'displayName avatarUrl');

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Unpin message
// @route   DELETE /api/messages/:id/pin
// @access  Private
export const unpinMessage = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (message.senderId.toString() !== user._id.toString() && message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only unpin messages in your conversation.' });
    }

    message.isPinned = false;
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'displayName avatarUrl')
      .populate('recipientId', 'displayName avatarUrl');

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get pinned messages
// @route   GET /api/messages/pinned
// @access  Private
export const getPinnedMessages = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner.' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: user._id, recipientId: user.partnerId },
        { senderId: user.partnerId, recipientId: user._id },
      ],
      isPinned: true,
      deletedBy: { $ne: user._id },
    })
    .populate('senderId', 'displayName avatarUrl')
    .populate('recipientId', 'displayName avatarUrl')
    .sort({ createdAt: -1 });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is the recipient
    if (message.recipientId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only mark messages as read if you are the recipient.' });
    }

    message.isRead = true;
    message.deliveryStatus = 'read';
    message.readAt = new Date();
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'displayName avatarUrl')
      .populate('recipientId', 'displayName avatarUrl');

    res.json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Search messages
// @route   GET /api/messages/search
// @access  Private
export const searchMessages = async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const user = req.user;

  try {
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner.' });
    }

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: user._id, recipientId: user.partnerId },
        { senderId: user.partnerId, recipientId: user._id },
      ],
      content: { $regex: q, $options: 'i' },
      deletedBy: { $ne: user._id },
      isDeleted: false,
    })
    .populate('senderId', 'displayName avatarUrl')
    .populate('recipientId', 'displayName avatarUrl')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get message by ID
// @route   GET /api/messages/:id
// @access  Private
export const getMessageById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const message = await Message.findById(id)
      .populate('senderId', 'displayName avatarUrl')
      .populate('recipientId', 'displayName avatarUrl')
      .populate('reactions.userId', 'displayName avatarUrl')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'senderId',
          select: 'displayName avatarUrl'
        }
      })
      .populate({
        path: 'forwardedFrom',
        populate: {
          path: 'senderId',
          select: 'displayName avatarUrl'
        }
      });

    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Check if user is part of the conversation
    if (message.senderId._id.toString() !== user._id.toString() && message.recipientId._id.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'You can only view messages in your conversation.' });
    }

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
