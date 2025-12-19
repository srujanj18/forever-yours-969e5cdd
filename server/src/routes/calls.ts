import express from 'express';
import { getHistory } from '../controllers/calls';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/history', protect, getHistory);

export default router;