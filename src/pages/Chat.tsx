import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, Image as ImageIcon, Mic, Heart, UserPlus, Users, X, ArrowLeft, Reply, Pen, Camera, Smile, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { api } from "@/lib/api";
import ChatMessage from '@/components/ChatMessage';
import { io, Socket } from "socket.io-client";

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

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [partnerEmail, setPartnerEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption: string } | null>(null);



  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isPartnerActive, setIsPartnerActive] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showDeleteOptions, setShowDeleteOptions] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Listen for avatar changes from other components (like Profile page)
  useEffect(() => {
    const handleAvatarChange = (e: StorageEvent) => {
      if (e.key === 'userAvatarUrl' && currentUser) {
        // Update the current user's avatar URL
        setCurrentUser(prev => prev ? {
          ...prev,
          avatarUrl: e.newValue ? `${e.newValue}?t=${Date.now()}` : undefined
        } : null);
      }
    };

    window.addEventListener('storage', handleAvatarChange);
    return () => window.removeEventListener('storage', handleAvatarChange);
  }, [currentUser]);

  const loadUserProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setCurrentUser(response.data.user);
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
      if (error.code === 'ERR_NETWORK') {
        toast({
          title: "Connection Error",
          description: "Failed to connect to server. Is it running?",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load user profile.",
          variant: "destructive",
        });
      }
      // Fallback: create user from Firebase auth data
      const user = auth.currentUser;
      if (user) {
        setCurrentUser({
          _id: user.uid,
          firebaseUid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          avatarUrl: user.photoURL || undefined,
          partnerId: undefined
        });
      }
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.get('/messages');
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadUserProfile();
      } else {
        navigate("/auth");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Reload profile when page comes into focus (handles invitation acceptance)
  useEffect(() => {
    const handleFocus = () => {
      loadUserProfile();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (currentUser?.partnerId) {
      loadMessages();

      // Set up interval to refresh messages every 2 seconds for real-time feel
      const interval = setInterval(loadMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser?._id, currentUser?.partnerId?._id]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && isInitialLoad && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      setIsInitialLoad(false);
    }
  }, [messages, isInitialLoad]);

  // Auto-scroll for new messages (WhatsApp-like behavior)
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0 && messagesContainerRef.current && messagesEndRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100; // Within 100px of bottom

      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isInitialLoad]);



  // Activity detection and status updates
  useEffect(() => {
    if (!socket || !currentUser?.partnerId) return;

    const updateActivity = (isActive: boolean) => {
      socket.emit('update-activity', {
        userId: currentUser._id,
        isActive,
        partnerId: currentUser.partnerId._id
      });
    };

    const handleVisibilityChange = () => {
      const isActive = !document.hidden;
      updateActivity(isActive);
    };

    const handleFocus = () => {
      updateActivity(true);
    };

    const handleBlur = () => {
      updateActivity(false);
    };

    // Set initial activity status
    updateActivity(true);

    // Listen for visibility changes (tab switching)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for window focus/blur (app switching)
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [socket, currentUser]);

  // Socket initialization and event handling
  useEffect(() => {
    if (currentUser && currentUser.partnerId) {
      // Disconnect existing socket if any
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }

      const newSocket = io('http://127.0.0.1:5000', {
        forceNew: true, // Force a new connection
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      });

      console.log('Attempting to connect to socket server...');

      newSocket.on('connect', () => {
        console.log('✅ Connected to socket server successfully');
        // Register user when connected
        newSocket.emit('register-user', currentUser._id);
        console.log('📤 Emitted register-user with ID:', currentUser._id);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        console.error('Connection details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('❌ Socket reconnection error:', error);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('❌ Socket reconnection failed completely');
      });

      newSocket.on('partner-online', (data) => {
        console.log('Partner came online:', data.userId);
        setIsPartnerOnline(true);
      });

      newSocket.on('partner-offline', (data) => {
        console.log('Partner went offline:', data.userId);
        setIsPartnerOnline(false);
      });

      newSocket.on('partner-active', (data) => {
        console.log('Partner became active:', data.userId);
        setIsPartnerActive(true);
      });

      newSocket.on('partner-inactive', (data) => {
        console.log('Partner became inactive:', data.userId);
        setIsPartnerActive(false);
      });

      newSocket.on('partner-typing', (data) => {
        console.log('Partner is typing:', data.userId);
        setIsPartnerTyping(true);
      });

      newSocket.on('partner-stop-typing', (data) => {
        console.log('Partner stopped typing:', data.userId);
        setIsPartnerTyping(false);
      });

      newSocket.on('partner-avatar-updated', (data) => {
        console.log('Partner avatar updated:', data.userId, data.avatarUrl);
        // Update partner's avatar in current user state
        setCurrentUser(prev => prev ? {
          ...prev,
          partnerId: prev.partnerId ? {
            ...prev.partnerId,
            avatarUrl: data.avatarUrl
          } : undefined
        } : null);
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.disconnect();
        setSocket(null);
      };
    } else {
      // Clean up socket if no current user or partner
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [currentUser?._id, currentUser?.partnerId?._id]);

  const generateInvitation = async () => {
    if (!partnerEmail.trim() || !partnerEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post('/auth/generate-invitation', {
        partnerEmail: partnerEmail.trim()
      });

      toast({
        title: "Invitation Sent!",
        description: response.data.message,
      });

      if (response.data.partner) {
        // Direct connection successful
        loadUserProfile();
      } else {
        // Pending invitation
        setPartnerEmail("");
      }
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK') {
        toast({
          title: "Connection Error",
          description: "Failed to connect to server. Is it running?",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.response?.data?.error || "Failed to send invitation",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!currentUser?.partnerId) {
      toast({
        title: "Error",
        description: "You need a partner connected to share images",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', '📸 Shared a photo');

      const response = await api.post('/gallery/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Send a message with the image media
      await api.post('/messages', {
        content: '📸 Shared a photo',
        mediaUrl: response.data.mediaUrl,
        mediaType: file.type,
      });

      toast({
        title: "Success! 📸",
        description: "Photo shared",
      });

      // Reload messages
      loadMessages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser?.partnerId) return;

    try {
      const response = await api.post('/messages', {
        content: newMessage,
        replyTo: replyingTo?._id,
      });

      setMessages(prev => [...prev, response.data]);
      setNewMessage("");
      setReplyingTo(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const startEditing = (message: Message) => {
    setEditingMessage(message);
    setEditContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editingMessage || !editContent.trim()) return;

    try {
      await api.put(`/messages/${editingMessage._id}`, {
        content: editContent.trim(),
      });

      setMessages(prev => prev.map(msg =>
        msg._id === editingMessage._id
          ? { ...msg, content: editContent.trim(), isEdited: true }
          : msg
      ));

      setEditingMessage(null);
      setEditContent("");

      toast({
        title: "Message edited",
        description: "Your message has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to edit message",
        variant: "destructive",
      });
    }
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}/delete-for-everyone`);

      // Update the message content to show it's deleted
      setMessages(prev => prev.map(msg =>
        msg._id === messageId
          ? { ...msg, content: 'This message has been deleted' }
          : msg
      ));

      toast({
        title: "Message deleted",
        description: "Message deleted for everyone",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const deleteMessageForMe = async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}/delete-for-me`);

      // Remove the message from local state
      setMessages(prev => prev.filter(msg => msg._id !== messageId));

      toast({
        title: "Message deleted",
        description: "Message deleted for you",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      const response = await api.post(`/messages/${messageId}/reactions`, {
        emoji,
      });

      // Update the message in local state
      setMessages(prev => prev.map(msg =>
        msg._id === messageId ? response.data : msg
      ));

      toast({
        title: "Reaction added",
        description: `You reacted with ${emoji}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to add reaction",
        variant: "destructive",
      });
    }
  };



  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };



  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-rose-900/20">
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-br from-rose-400 to-pink-500 p-6 rounded-full shadow-lg animate-pulse">
            <Heart className="w-12 h-12 text-white" fill="white" />
          </div>
          <p className="text-rose-600 dark:text-pink-400 font-medium">Loading your love story...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-env(safe-area-inset-bottom))] bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-rose-900/20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-rose-200/50 dark:border-purple-700/50 p-2 md:p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0 h-9 w-9 md:h-10 md:w-10 hover:bg-rose-100 dark:hover:bg-purple-900/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/partner-profile")}
            className="flex items-center gap-2 flex-1 min-w-0 p-0 hover:bg-rose-50 dark:hover:bg-purple-900/50 rounded-lg transition-colors"
          >
            <div className="relative shrink-0">
              <div className="bg-gradient-to-br from-rose-400 to-pink-500 p-2 rounded-full shadow-md">
                <Heart className="w-5 h-5 text-white" fill="white" />
              </div>
              {isPartnerOnline && <div className="absolute -top-0 -right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 animate-bounce"></div>}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h1 className="text-base md:text-lg font-serif font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent truncate">
                {currentUser.partnerId ? (currentUser.customPartnerName || currentUser.partnerId.displayName) : "Our Love Chat"}
              </h1>
              <p className="text-xs text-rose-600 dark:text-pink-400 font-medium truncate">
                {isPartnerTyping ? "typing..." : isPartnerOnline ? "online" : "offline"}
              </p>
            </div>
          </Button>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 hover:bg-rose-100 dark:hover:bg-purple-900/50"
              onClick={() => setShowMessageMenu('options')}
            >
              <MoreVertical className="w-5 h-5 text-rose-500 dark:text-pink-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Partner Connection or Messages */}
      {!currentUser.partnerId ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="bg-gradient-to-br from-rose-200 to-pink-300 dark:from-rose-800 dark:to-pink-800 p-6 rounded-full shadow-lg mx-auto w-fit">
              <UserPlus className="w-12 h-12 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-bold text-rose-700 dark:text-rose-300">
                Connect with Your Partner
              </h3>
              <p className="text-rose-600 dark:text-pink-400 max-w-xs mx-auto">
                Enter your partner's email to send them an invitation to chat.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                generateInvitation();
              }}
            >
              <Input
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="Partner's email address..."
                type="email"
                className="w-full border-rose-200 dark:border-purple-700 focus:border-rose-400 dark:focus:border-pink-400"
              />
              <Button
                type="submit"
                disabled={!partnerEmail.trim() || isLoading}
                className="w-full bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white"
              >
                {isLoading ? "Sending Invitation..." : "Send Invitation"}
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 space-y-4 md:space-y-6 bg-gradient-to-b from-transparent via-rose-50/30 to-pink-50/30 dark:via-purple-900/10 dark:to-rose-900/10"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="bg-gradient-to-br from-rose-200 to-pink-300 dark:from-rose-800 dark:to-pink-800 p-6 rounded-full shadow-lg">
                  <Heart className="w-12 h-12 text-white animate-pulse" fill="white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-bold text-rose-700 dark:text-rose-300">
                    Start Your Love Story
                  </h3>
                  <p className="text-rose-600 dark:text-pink-400 max-w-sm">
                    Send your first message and begin creating beautiful memories together
                  </p>
                </div>
              </div>
            )}
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId._id === currentUser._id;
              const prevMessage = messages[index - 1];
              const showAvatar =
                !prevMessage || prevMessage.senderId._id !== message.senderId._id;

              return (
                <ChatMessage
                  key={message._id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  currentUser={currentUser}
                  showAvatar={showAvatar}
                  getInitials={getInitials}
                  setSelectedImage={setSelectedImage}
                  setShowMessageMenu={setShowMessageMenu}
                  onReply={setReplyingTo}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator - Positioned above input bar */}
          {isPartnerTyping && (
            <div className="px-2 md:px-4 pb-2">
              <div className="flex items-end gap-2 md:gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 border-3 border-white dark:border-gray-800 shadow-lg ring-2 ring-rose-200 dark:ring-purple-700">
                    <AvatarImage src={currentUser.partnerId?.avatarUrl ? `${currentUser.partnerId.avatarUrl}` : undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-500 text-white text-sm font-bold shadow-inner">
                      {currentUser.partnerId ? getInitials(currentUser.partnerId.displayName) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
                </div>
                <div className="max-w-[85vw] md:max-w-[75%] items-start">
                  <p className="text-xs font-medium mb-1 px-2 text-left text-pink-600">
                    {currentUser.partnerId?.displayName}
                  </p>
                  <div className="bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-gray-100 border border-rose-100 dark:border-purple-700 shadow-lg backdrop-blur-sm rounded-2xl md:rounded-3xl px-3 md:px-5 py-2 md:py-3 relative">
                    <div className="flex items-center gap-1">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">typing...</span>
                    </div>
                    <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white/90 dark:border-r-gray-800/90 border-b-8 border-b-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reply Preview */}
          {replyingTo && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-t border-rose-200/50 dark:border-purple-700/50 px-2 md:px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Reply className="w-3 h-3 text-rose-500 dark:text-pink-400" />
                    <p className="text-xs font-medium text-rose-600 dark:text-pink-400">
                      Replying to {replyingTo.senderId.displayName}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {replyingTo.content}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReplyingTo(null)}
                  className="shrink-0 h-6 w-6 hover:bg-rose-100 dark:hover:bg-purple-900/50"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Edit Preview */}
          {editingMessage && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-t border-rose-200/50 dark:border-purple-700/50 px-2 md:px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Pen className="w-3 h-3 text-rose-500 dark:text-pink-400" />
                    <p className="text-xs font-medium text-rose-600 dark:text-pink-400">
                      Editing message
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {editingMessage.content}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={saveEdit}
                    disabled={!editContent.trim() || editContent.trim() === editingMessage.content}
                    className="shrink-0 h-6 w-6 hover:bg-green-100 dark:hover:bg-green-900/50"
                  >
                    <Send className="w-3 h-3 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelEditing}
                    className="shrink-0 h-6 w-6 hover:bg-rose-100 dark:hover:bg-purple-900/50"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-t border-rose-200/50 dark:border-purple-700/50 p-2 md:p-4 shadow-lg">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file);
                }
              }}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file);
                }
              }}
              className="hidden"
            />

            <form onSubmit={editingMessage ? (e) => { e.preventDefault(); saveEdit(); } : sendMessage} className="flex items-end gap-2">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={uploadingImage || !!editingMessage}
                  onClick={() => imageInputRef.current?.click()}
                  className="shrink-0 h-10 w-10 md:h-12 md:w-12 border-rose-200 dark:border-purple-700 hover:bg-rose-50 dark:hover:bg-purple-900/50 transition-all duration-300 hover:scale-110 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Share a photo"
                >
                  {uploadingImage ? (
                    <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-rose-500 dark:text-pink-400" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={uploadingImage || !!editingMessage}
                  onClick={() => cameraInputRef.current?.click()}
                  className="shrink-0 h-10 w-10 md:h-12 md:w-12 border-rose-200 dark:border-purple-700 hover:bg-rose-50 dark:hover:bg-purple-900/50 transition-all duration-300 hover:scale-110 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Take a photo"
                >
                  {uploadingImage ? (
                    <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-rose-500 dark:text-pink-400" />
                  )}
                </Button>
              </div>
              <div className="flex-1 relative">
                <Input
                  value={editingMessage ? editContent : newMessage}
                  onChange={(e) => {
                    if (editingMessage) {
                      setEditContent(e.target.value);
                    } else {
                      setNewMessage(e.target.value);

                      // Handle typing indicators
                      if (socket && currentUser?.partnerId) {
                        if (e.target.value.trim()) {
                          socket.emit('start-typing', { toUserId: currentUser.partnerId._id });
                        }

                        // Clear existing timeout
                        if (typingTimeoutRef.current) {
                          clearTimeout(typingTimeoutRef.current);
                        }

                        // Set new timeout to stop typing indicator after 2 seconds of inactivity
                        typingTimeoutRef.current = setTimeout(() => {
                          if (socket) {
                            socket.emit('stop-typing', { toUserId: currentUser.partnerId._id });
                          }
                        }, 2000);
                      }
                    }
                  }}
                  placeholder={editingMessage ? "Edit your message..." : "Share your love..."}
                  className="pr-8 md:pr-12 py-2 md:py-3 rounded-full border-2 border-rose-200 dark:border-purple-700 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm focus:border-rose-400 dark:focus:border-pink-400 focus:ring-2 md:focus:ring-4 focus:ring-rose-100 dark:focus:ring-purple-900 transition-all duration-300 text-sm md:text-base text-gray-700 dark:text-gray-100 placeholder:text-rose-400 dark:placeholder:text-pink-400 shadow-inner"
                />
                {(editingMessage ? editContent : newMessage).trim() && (
                  <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={!(editingMessage ? editContent.trim() : newMessage.trim())}
                className="shrink-0 h-10 w-10 md:h-12 md:w-12 bg-gradient-to-br from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl disabled:hover:scale-100 rounded-full p-2"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </>
      )}

      {/* Fullscreen Image Viewer */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="flex flex-col items-center gap-4 max-w-4xl w-full">
              <img
                src={selectedImage.url}
                alt={selectedImage.caption}
                className="max-h-[80vh] max-w-full object-contain"
              />
              {selectedImage.caption && (
                <p className="text-white text-center text-lg">{selectedImage.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Options Modal */}
      {showDeleteOptions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Message
            </h3>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  deleteMessageForMe(showDeleteOptions);
                  setShowDeleteOptions(null);
                }}
                variant="outline"
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Delete for me
              </Button>
              <Button
                onClick={() => {
                  deleteMessageForEveryone(showDeleteOptions);
                  setShowDeleteOptions(null);
                }}
                variant="outline"
                className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete for everyone
              </Button>
            </div>
            <Button
              onClick={() => setShowDeleteOptions(null)}
              variant="ghost"
              className="w-full mt-4 text-gray-500 dark:text-gray-400"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reaction Picker Modal */}
      {showReactionPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              React to Message
            </h3>
            <div className="grid grid-cols-6 gap-3">
              {[
                '❤️', '👍', '😂', '😢', '😮', '😍', '😡', '👏',
                '🔥', '💯', '🙌', '🤔', '😊', '🥰', '😘', '🤗',
                '😉', '😎', '🤩', '🥳', '😭', '😤', '🤤', '🤪'
              ].map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 text-2xl hover:bg-rose-100 dark:hover:bg-purple-900/50"
                  onClick={() => {
                    addReaction(showReactionPicker, emoji);
                    setShowReactionPicker(null);
                  }}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => setShowReactionPicker(null)}
              variant="ghost"
              className="w-full mt-4 text-gray-500 dark:text-gray-400"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Message Menu Modal */}
      {showMessageMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Message Options
            </h3>
            <div className="space-y-3">
              {(() => {
                const message = messages.find(m => m._id === showMessageMenu);
                const isOwnMessage = message?.senderId._id === currentUser._id;
                return (
                  <>
                    <Button
                      onClick={() => {
                        if (message) setReplyingTo(message);
                        setShowMessageMenu(null);
                      }}
                      variant="outline"
                      className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Reply
                    </Button>
                    <Button
                      onClick={() => {
                        setShowReactionPicker(showMessageMenu);
                        setShowMessageMenu(null);
                      }}
                      variant="outline"
                      className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Smile className="w-4 h-4 mr-2" />
                      React
                    </Button>
                    {isOwnMessage && !message?.mediaUrl && (
                      <Button
                        onClick={() => {
                          if (message) startEditing(message);
                          setShowMessageMenu(null);
                        }}
                        variant="outline"
                        className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Pen className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setShowDeleteOptions(showMessageMenu);
                        setShowMessageMenu(null);
                      }}
                      variant="outline"
                      className="w-full justify-start text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </>
                );
              })()}
            </div>
            <Button
              onClick={() => setShowMessageMenu(null)}
              variant="ghost"
              className="w-full mt-4 text-gray-500 dark:text-gray-400"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;