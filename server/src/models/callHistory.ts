import mongoose, { Document, Schema } from 'mongoose';

export interface ICallHistory extends Document {
  callerId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  callType: 'voice' | 'video';
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  status: 'completed' | 'missed' | 'rejected';
}

const callHistorySchema: Schema = new Schema({
  callerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    required: true,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  endedAt: {
    type: Date,
  },
  duration: {
    type: Number, // in seconds
  },
  status: {
    type: String,
    enum: ['completed', 'missed', 'rejected'],
    default: 'completed',
  },
}, {
  timestamps: true,
});

// Index for efficient queries
callHistorySchema.index({ callerId: 1, startedAt: -1 });
callHistorySchema.index({ receiverId: 1, startedAt: -1 });

const CallHistory = mongoose.model<ICallHistory>('CallHistory', callHistorySchema);

export default CallHistory;
