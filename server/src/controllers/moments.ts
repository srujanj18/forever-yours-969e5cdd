import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Moment from '../models/moment';

// @desc    Get all moments between partners
// @route   GET /api/moments
// @access  Private
export const getMoments = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user.partnerId) {
      return res.status(200).json({ moments: [] });
    }

    const moments = await Moment.find({
      $or: [
        { senderId: user._id, recipientId: user.partnerId },
        { senderId: user.partnerId, recipientId: user._id },
      ],
    })
    .sort({ date: -1 });

    res.json({ moments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Create a moment
// @route   POST /api/moments
// @access  Private
export const createMoment = async (req: AuthRequest, res: Response) => {
  const { title, description, date } = req.body;
  const user = req.user;

  try {
    if (!user.partnerId) {
      return res.status(400).json({ error: 'You are not connected with a partner.' });
    }

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required.' });
    }

    const moment = new Moment({
      senderId: user._id,
      recipientId: user.partnerId,
      title,
      description: description || undefined,
      date: new Date(date),
    });

    await moment.save();

    res.status(201).json(moment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a moment
// @route   DELETE /api/moments/:id
// @access  Private
export const deleteMoment = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const moment = await Moment.findById(id);
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found.' });
    }

    if (moment.senderId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this moment.' });
    }

    await Moment.findByIdAndDelete(id);

    res.json({ message: 'Moment deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
