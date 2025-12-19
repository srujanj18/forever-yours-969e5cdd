import express from 'express';
import { getMoments, createMoment, deleteMoment } from '../controllers/moments';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getMoments);
router.post('/', protect, createMoment);
router.delete('/:id', protect, deleteMoment);

export default router;
