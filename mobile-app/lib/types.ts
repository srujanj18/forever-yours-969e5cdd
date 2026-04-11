export type PartnerSummary = {
  _id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
};

export type UserProfile = {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  customPartnerName?: string;
  partnerId?: PartnerSummary | null;
};

export type MessageUser = {
  _id: string;
  displayName: string;
  avatarUrl?: string;
};

export type MessageReaction = {
  userId: MessageUser;
  emoji: string;
  createdAt: string;
};

export type Message = {
  _id: string;
  senderId: MessageUser;
  recipientId: MessageUser;
  content: string;
  isRead: boolean;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  viewOnce?: boolean;
  openedAt?: string | null;
  replyTo?: {
    _id: string;
    senderId: MessageUser;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
  } | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: MessageReaction[];
  deliveryStatus?: 'sent' | 'delivered' | 'read';
};

export type MediaItem = {
  _id: string;
  senderId: string;
  recipientId: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  createdAt: string;
};

export type Moment = {
  _id: string;
  senderId: string;
  recipientId: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: string;
  date: string;
  createdAt: string;
};

export type Goal = {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  targetDate: string;
  isCompleted: boolean;
};

export type CallHistory = {
  _id: string;
  callerId: { _id: string; displayName: string };
  receiverId: { _id: string; displayName: string };
  callType: 'voice' | 'video';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  status: string;
};
