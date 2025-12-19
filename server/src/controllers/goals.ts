import { Request, Response } from 'express';
import Goal from '../models/goal';
import { AuthRequest } from '../middleware/auth';

export const getGoals = async (req: AuthRequest, res: Response) => {
  try {
    const goals = await Goal.find({ userId: req.user._id }).sort({ targetDate: 1 });
    res.status(200).json({ goals });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching goals', error: error.message });
  }
};

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, targetDate } = req.body;
    const newGoal = new Goal({
      userId: req.user._id,
      title,
      description,
      targetDate,
    });
    await newGoal.save();
    res.status(201).json({ message: 'Goal created successfully', goal: newGoal });
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating goal', error: error.message });
  }
};

export const updateGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, targetDate, isCompleted } = req.body;
    const updatedGoal = await Goal.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { title, description, targetDate, isCompleted },
      { new: true }
    );
    if (!updatedGoal) {
      return res.status(404).json({ message: 'Goal not found' });
    }
    res.status(200).json({ message: 'Goal updated successfully', goal: updatedGoal });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating goal', error: error.message });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deletedGoal = await Goal.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!deletedGoal) {
      return res.status(404).json({ message: 'Goal not found' });
    }
    res.status(200).json({ message: 'Goal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting goal', error: error.message });
  }
};
