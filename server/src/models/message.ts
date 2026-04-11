
import mongoose, { Document, Schema } from 'mongoose';

export interface IMessageReaction {
  userId: mongoose.Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IMessage extends Document {
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  content: string;
  isRead: boolean;
  mediaUrl?: string;
  mediaType?: string;
  viewOnce?: boolean;
  openedAt?: Date;
  replyTo?: mongoose.Types.ObjectId;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedBy?: mongoose.Types.ObjectId[];
  reactions?: IMessageReaction[];
  messageType?: 'text' | 'image' | 'voice' | 'video' | 'document' | 'contact' | 'location' | 'gif' | 'sticker';
  forwardedFrom?: mongoose.Types.ObjectId;
  isPinned?: boolean;
  expiresAt?: Date;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
  readAt?: Date;
  formattedContent?: {
    bold?: string[];
    italic?: string[];
    strikethrough?: string[];
    links?: { url: string; text: string }[];
  };
}

const MessageReactionSchema = new Schema<IMessageReaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const messageSchema: Schema = new Schema({
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
  content: {
    type: String,
    default: '',
    trim: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  mediaUrl: {
    type: String,
    default: null,
  },
  mediaType: {
    type: String,
    default: null,
  },
  viewOnce: {
    type: Boolean,
    default: false,
  },
  openedAt: {
    type: Date,
    default: null,
  },
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  reactions: [MessageReactionSchema],
  messageType: {
    type: String,
    enum: ['text', 'image', 'voice', 'video', 'document', 'contact', 'location', 'gif', 'sticker'],
    default: 'text',
  },
  forwardedFrom: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  deliveryStatus: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  readAt: {
    type: Date,
    default: null,
  },
  formattedContent: {
    bold: [{ type: String }],
    italic: [{ type: String }],
    strikethrough: [{ type: String }],
    links: [{
      url: { type: String },
      text: { type: String },
    }],
  },
}, {
  timestamps: true,
});

// Index for efficient queries
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, isRead: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ isPinned: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
