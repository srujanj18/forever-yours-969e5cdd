
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  displayName: string;
  dateOfBirth?: Date;
  avatarUrl?: string;
  partnerId?: mongoose.Types.ObjectId;
  customPartnerName?: string;
  invitationToken?: string;
  invitationExpires?: Date;
}

const userSchema: Schema = new Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
  },
  avatarUrl: {
    type: String,
  },
  partnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  customPartnerName: {
    type: String,
  },
  invitationToken: {
    type: String,
  },
  invitationExpires: {
    type: Date,
  },
}, {
  timestamps: true,
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
