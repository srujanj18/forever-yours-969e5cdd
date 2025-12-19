
import React from 'react';
import { animated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Reply } from 'lucide-react';
import { format } from 'date-fns';

interface MessageReaction {
  userId: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  emoji: string;
  createdAt: string;
}

interface Message {
  _id: string;
  senderId: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  recipientId: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  content: string;
  isRead: boolean;
  createdAt: string;
  mediaUrl?: string;
  mediaType?: string;
  replyTo?: {
    _id: string;
    senderId: {
      _id: string;
      displayName: string;
      avatarUrl?: string;
    };
    content: string;
    mediaUrl?: string;
    mediaType?: string;
  };
  isEdited?: boolean;
  reactions?: MessageReaction[];
  messageType?: string;
  forwardedFrom?: {
    _id: string;
    senderId: {
      _id: string;
      displayName: string;
      avatarUrl?: string;
    };
    content: string;
  };
  isPinned?: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
}

interface User {
  _id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  customPartnerName?: string;
  avatarUrl?: string;
  partnerId?: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  currentUser: User;
  showAvatar: boolean;
  getInitials: (name: string) => string;
  setSelectedImage: (image: { url: string; caption: string } | null) => void;
  setShowMessageMenu: (id: string | null) => void;
  onReply: (message: Message) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isOwnMessage,
  currentUser,
  showAvatar,
  getInitials,
  setSelectedImage,
  setShowMessageMenu,
  onReply,
}) => {
  const [{ x, right }, api] = useSpring(() => ({
    x: 0,
    right: '-100%',
  }));

  const bind = useDrag(
    ({ active, movement: [mx], cancel }) => {
      if (mx > 100) cancel();

      api.start({
        x: active ? mx : 0,
        right: mx > 50 ? '0' : '-100%',
        config: { mass: 1, tension: 500, friction: 50 },
      });
      if (!active && mx > 50) {
        onReply(message);
      }
    },
    { axis: 'x' }
  );

  return (
    <div
      className={`flex items-end gap-1 md:gap-1 group ${
        isOwnMessage ? 'flex-row-reverse' : 'flex-row'
      }`}
    >

      <div
        className={`${
          isOwnMessage ? 'max-w-full items-end' : 'max-w-[95vw] md:max-w-[90%] items-start'
        }`}
      >
        {showAvatar && (
          <p
            className={`text-xs font-medium mb-1 px-2 ${
              isOwnMessage
                ? 'text-right text-rose-600'
                : 'text-left text-pink-600'
            }`}
          >
            {isOwnMessage ? 'You' : message.senderId.displayName}
          </p>
        )}
        <div className="relative">
          <animated.div
            {...bind()}
            style={{ x, touchAction: 'pan-y' }}
            className="flex items-end gap-2"
          >
            <div
              className={`relative rounded-2xl md:rounded-3xl px-4 md:px-6 py-3 md:py-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] group-hover:shadow-xl ${
                isOwnMessage
                  ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-200 dark:shadow-rose-900'
                  : 'bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-gray-100 border border-rose-100 dark:border-purple-700 shadow-pink-100 dark:shadow-purple-900'
              }`}
            >
              {message.replyTo && (
                <div
                  className={`mb-2 p-2 rounded-lg border-l-4 ${
                    isOwnMessage
                      ? 'border-white/50 bg-white/10'
                      : 'border-rose-300 bg-rose-50/50 dark:bg-purple-900/20 dark:border-purple-600'
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      isOwnMessage
                        ? 'text-white/80'
                        : 'text-rose-600 dark:text-pink-400'
                    }`}
                  >
                    {isOwnMessage
                      ? `Replying to ${message.replyTo.senderId.displayName}`
                      : 'Replying to your message'}
                  </p>
                  <p
                    className={`text-xs truncate ${
                      isOwnMessage
                        ? 'text-white/70'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {message.replyTo.content}
                  </p>
                </div>
              )}
              {message.mediaUrl &&
              message.mediaType?.startsWith('image/') ? (
                <div className="space-y-2">
                  <div className="w-64 h-64">
                    <img
                      src={`${message.mediaUrl}`}
                      alt={message.content}
                      className="w-full h-full object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() =>
                        setSelectedImage({
                          url: `${message.mediaUrl}`,
                          caption: message.content,
                        })
                      }
                    />
                  </div>
                  {message.content && (
                    <p className="text-sm leading-relaxed">
                      {message.content}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm leading-relaxed break-words">
                  {message.content}
                </p>
              )}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.reactions.map((reaction, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        isOwnMessage
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-100 dark:bg-purple-900/50 text-rose-700 dark:text-pink-300'
                      }`}
                    >
                      <span>{reaction.emoji}</span>
                      <span className="text-xs opacity-75">
                        {reaction.userId.displayName ===
                        currentUser?.displayName
                          ? 'You'
                          : reaction.userId.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {!isOwnMessage && (
                <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white/90 dark:border-r-gray-800/90 border-b-8 border-b-transparent"></div>
              )}
              {isOwnMessage && (
                <div className="absolute -right-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-rose-500 border-b-8 border-b-transparent"></div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-rose-100 dark:hover:bg-purple-900/50"
                onClick={() => setShowMessageMenu(message._id)}
              >
                <MoreVertical className="w-4 h-4 text-rose-500 dark:text-pink-400" />
              </Button>
            </div>
          </animated.div>
        </div>
        <p
          className={`text-xs mt-1 px-2 font-medium ${
            isOwnMessage
              ? 'text-right text-rose-500'
              : 'text-left text-pink-500'
          }`}
        >
          {format(new Date(message.createdAt), 'HH:mm')}
          {isOwnMessage && <span className="ml-1">❤️</span>}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
