import { Schema, model, Document } from 'mongoose';
import { IUser } from './user';

export interface IGoal extends Document {
  userId: IUser['_id'];
  title: string;
  description?: string;
  targetDate: Date;
  isCompleted: boolean;
}

const goalSchema = new Schema<IGoal>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  targetDate: {
    type: Date,
    required: true,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default model<IGoal>('Goal', goalSchema);
