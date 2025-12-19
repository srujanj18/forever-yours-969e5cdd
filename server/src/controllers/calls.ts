import { Response } from 'express';
import CallHistory from '../models/callHistory';
import { AuthRequest, protect } from '../middleware/auth';

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const history = await CallHistory.find({
      $or: [
        { callerId: req.user._id },
        { receiverId: req.user._id },
      ],
    })
      .sort({ startedAt: -1 })
      .limit(limit)
      .populate('callerId', 'displayName')
      .populate('receiverId', 'displayName')
      .lean();

    res.json({ history });
  } catch (error: any) {
    console.error('Failed to get call history:', error.message);
    res.status(500).json({ error: 'Failed to get call history' });
  }
};