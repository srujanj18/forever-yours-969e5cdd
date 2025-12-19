import mongoose, { Document, Schema } from 'mongoose';

export interface IMoment extends Document {
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const momentSchema: Schema = new Schema({
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  mediaUrl: {
    type: String,
  },
  mediaType: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

const Moment = mongoose.model<IMoment>('Moment', momentSchema);

export default Moment;
