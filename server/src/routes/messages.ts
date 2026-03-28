
import express from 'express';
import { getMessages, sendMessage, sendVoiceMessage, editMessage, deleteMessageForEveryone, deleteMessageForMe, addReaction, removeReaction } from '../controllers/messages';
import { protect } from '../middleware/auth';
import { createRateLimit, validateMessageInput } from '../middleware/security';

const router = express.Router();

// Rate limiting for message endpoints
const messageRateLimit = createRateLimit(60 * 1000, 30); // 30 requests per minute for messages
const strictMessageRateLimit = createRateLimit(60 * 1000, 10); // 10 requests per minute for destructive operations

router.get('/', protect, getMessages);
router.post('/', messageRateLimit, protect, validateMessageInput, sendMessage);
router.post('/audio', messageRateLimit, protect, sendVoiceMessage);
router.put('/:id', messageRateLimit, protect, validateMessageInput, editMessage);
router.delete('/:id/delete-for-everyone', strictMessageRateLimit, protect, deleteMessageForEveryone);
router.delete('/:id/delete-for-me', strictMessageRateLimit, protect, deleteMessageForMe);
router.post('/:id/reactions', messageRateLimit, protect, addReaction);
router.delete('/:id/reactions', messageRateLimit, protect, removeReaction);

export default router;
