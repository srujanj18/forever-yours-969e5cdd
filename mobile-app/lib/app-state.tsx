import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AppState, InteractionManager, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { api, SOCKET_URL } from './api';
import { auth, signInWithEmail, signOutUser, signUpWithEmail } from './firebase';
import type { CallHistory, Goal, MediaItem, Message, Moment, UserProfile } from './types';

type AuthMode = 'login' | 'signup';
type UploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

type IncomingCall = {
  fromUserId: string;
  fromUserName?: string;
  offer: any;
  callType?: 'voice' | 'video';
  callId?: string;
};

type CallOfferSignal = {
  fromUserId: string;
  offer: any;
  callType?: 'voice' | 'video';
  signalId: string;
};

type CallAnswerSignal = {
  fromUserId: string;
  answer: any;
  signalId: string;
};

type CallIceCandidateSignal = {
  fromUserId: string;
  candidate: any;
  signalId: string;
};

type MessageDeliveryPayload = {
  clientTempId?: string;
  message: Message;
};

type ChatNotification = {
  messageId: string;
  senderName: string;
  preview: string;
  unreadCount: number;
};

type AppStateValue = {
  authMode: AuthMode;
  isInitializing: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  authUser: FirebaseUser | null;
  currentUser: UserProfile | null;
  partner: UserProfile['partnerId'];
  messages: Message[];
  gallery: MediaItem[];
  moments: Moment[];
  goals: Goal[];
  calls: CallHistory[];
  partnerOnline: boolean;
  partnerTyping: boolean;
  activeCallType: 'voice' | 'video' | null;
  incomingCall: IncomingCall | null;
  callAcceptedAt: number;
  latestOfferSignal: CallOfferSignal | null;
  latestAnswerSignal: CallAnswerSignal | null;
  latestIceCandidateSignal: CallIceCandidateSignal | null;
  unreadChatCount: number;
  latestChatNotification: ChatNotification | null;
  error: string | null;
  setAuthMode: (mode: AuthMode) => void;
  setActivePath: (path: string) => void;
  dismissChatNotification: () => void;
  markConversationAsRead: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendMessage: (text: string, replyTo?: string) => Promise<void>;
  sendMediaMessage: (asset: UploadAsset, caption?: string, replyTo?: string) => Promise<void>;
  sendVoiceMessage: (asset: UploadAsset, replyTo?: string) => Promise<void>;
  editMessage: (id: string, text: string) => Promise<void>;
  deleteMessage: (id: string, deleteForEveryone?: boolean) => Promise<void>;
  reactToMessage: (id: string, emoji: string) => Promise<void>;
  removeReaction: (id: string) => Promise<void>;
  generateInvitation: (email: string) => Promise<{ message: string; invitationLink?: string; emailSent?: boolean }>;
  acceptInvitation: (token?: string) => Promise<boolean>;
  addMoment: (title: string, description: string, date: string) => Promise<void>;
  deleteMoment: (id: string) => Promise<void>;
  addGoal: (title: string, description: string, targetDate: string) => Promise<void>;
  toggleGoal: (id: string, nextValue: boolean) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateCurrentUserName: (name: string) => Promise<void>;
  updatePartnerNickname: (name: string) => Promise<void>;
  uploadGalleryItem: (asset: ImagePickerAsset, caption: string) => Promise<void>;
  deleteGalleryItem: (id: string) => Promise<void>;
  uploadAvatar: (asset: ImagePickerAsset) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  startCall: (type: 'voice' | 'video') => void;
  initiateCall: (toUserId: string, offer: any, type: 'voice' | 'video') => void;
  acceptCall: (answer: any) => void;
  rejectCall: () => void;
  endCall: () => void;
  sendOffer: (toUserId: string, offer: any, callType?: 'voice' | 'video') => void;
  sendAnswer: (toUserId: string, answer: any) => void;
  sendIceCandidate: (toUserId: string, candidate: any) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);
const UNREAD_STORAGE_KEY = 'chat-live-unread-message-ids-v2';

function getMessagePreview(message: Pick<Message, 'content' | 'mediaType'>) {
  const content = message.content?.trim();
  if (content && content.toLowerCase() !== 'shared a photo' && content.toLowerCase() !== 'shared a video') {
    return content;
  }

  if (message.mediaType?.startsWith('audio/')) return 'Voice message';
  if (message.mediaType?.startsWith('video/')) return 'Video attachment';
  if (message.mediaType?.startsWith('image/')) return 'Photo attachment';
  return 'New message';
}

async function optimizeUploadAsset(asset: UploadAsset): Promise<UploadAsset> {
  const normalizedType = asset.type || (asset.mimeType?.startsWith('video') ? 'video' : asset.mimeType?.startsWith('audio') ? 'audio' : 'image');
  if (Platform.OS === 'web' || normalizedType !== 'image' || !asset.uri) {
    return asset;
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      {
        compress: 0.72,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const originalName = asset.fileName?.replace(/\.\w+$/, '') || `image-${Date.now()}`;
    return {
      ...asset,
      uri: result.uri,
      fileName: `${originalName}.jpg`,
      mimeType: 'image/jpeg',
      type: 'image',
    };
  } catch {
    return asset;
  }
}

async function buildFileFormData(fieldName: string, asset: UploadAsset, extra?: Record<string, string>) {
  const preparedAsset = await optimizeUploadAsset(asset);
  const formData = new FormData();
  const normalizedType = preparedAsset.type || (preparedAsset.mimeType?.startsWith('video') ? 'video' : preparedAsset.mimeType?.startsWith('audio') ? 'audio' : 'image');
  const mimeType =
    preparedAsset.mimeType ||
    (normalizedType === 'video' ? 'video/mp4' : normalizedType === 'audio' ? 'audio/m4a' : 'image/jpeg');
  const inferredExtension =
    preparedAsset.fileName?.split('.').pop()?.trim().toLowerCase() ||
    MIME_TYPE_TO_EXTENSION[mimeType] ||
    (normalizedType === 'video' ? 'mp4' : normalizedType === 'audio' ? 'm4a' : 'jpg');
  const baseFileName =
    preparedAsset.fileName?.trim().replace(/[^\w.-]/g, '_') ||
    `${fieldName}-${Date.now()}.${inferredExtension}`;
  const fileName = /\.[A-Za-z0-9]+$/.test(baseFileName) ? baseFileName : `${baseFileName}.${inferredExtension}`;

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(preparedAsset.uri);
    const blob = await fileResponse.blob();
    formData.append(fieldName, blob, fileName);
  } else {
    let uploadUri = preparedAsset.uri;

    if (!uploadUri.startsWith('file://') && !uploadUri.startsWith('/')) {
      const cacheRoot = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!cacheRoot) {
        throw new Error('Unable to prepare this file for upload on your device.');
      }

      const sanitizedFieldName = fieldName.replace(/[^\w-]/g, '_');
      const destinationUri = `${cacheRoot}${sanitizedFieldName}-${Date.now()}.${inferredExtension}`;
      await FileSystem.copyAsync({
        from: uploadUri,
        to: destinationUri,
      });
      uploadUri = destinationUri;
    }

    formData.append(fieldName, {
      uri: uploadUri,
      name: fileName,
      type: mimeType,
    } as any);
  }

  if (extra) {
    Object.entries(extra).forEach(([key, value]) => formData.append(key, value));
  }
  return formData;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [activeCallType, setActiveCallType] = useState<'voice' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callAcceptedAt, setCallAcceptedAt] = useState(0);
  const [latestOfferSignal, setLatestOfferSignal] = useState<CallOfferSignal | null>(null);
  const [latestAnswerSignal, setLatestAnswerSignal] = useState<CallAnswerSignal | null>(null);
  const [latestIceCandidateSignal, setLatestIceCandidateSignal] = useState<CallIceCandidateSignal | null>(null);
  const [activePath, setActivePathState] = useState('/');
  const [unreadMessageIds, setUnreadMessageIds] = useState<string[]>([]);
  const [latestChatNotification, setLatestChatNotification] = useState<ChatNotification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrappingRef = useRef(false);
  const appVisibilityRef = useRef(AppState.currentState);
  const unreadLoadedRef = useRef(false);

  const partner = currentUser?.partnerId || null;
  const isSignedIn = !!authUser;
  const unreadChatCount = unreadMessageIds.length;

  const upsertMessage = useCallback((incomingMessage: Message) => {
    setMessages((prev) => {
      const index = prev.findIndex((item) => item._id === incomingMessage._id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = incomingMessage;
        return next;
      }

      return [...prev, incomingMessage].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const response = await api.get<{ user: UserProfile }>('/auth/profile');
    setCurrentUser(response.user);
  }, []);

  const reconcileUnreadMessages = useCallback((incomingMessages: Message[], nextPath = activePath) => {
    if (nextPath === '/chat') {
      setUnreadMessageIds([]);
      return;
    }

    setUnreadMessageIds((prev) =>
      prev.filter((messageId) =>
        incomingMessages.some((message) => message._id === messageId && !message.isRead && !message.isDeleted)
      )
    );
  }, [activePath]);

  const markMessageAsDeliveredInternal = useCallback(async (messageId: string) => {
    try {
      const response = await api.put<Message>(`/messages/${messageId}/delivered`, {});
      upsertMessage(response);
    } catch {}
  }, [upsertMessage]);

  const markMessageAsReadInternal = useCallback(async (messageId: string) => {
    try {
      const response = await api.put<Message>(`/messages/${messageId}/read`, {});
      upsertMessage(response);
      setUnreadMessageIds((prev) => prev.filter((id) => id !== messageId));
    } catch {}
  }, [upsertMessage]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await api.get<Message[]>('/messages');
      setMessages(response);
      reconcileUnreadMessages(response);

      if (activePath === '/chat' && currentUser?._id) {
        const unreadIncoming = response.filter(
          (message) => message.senderId?._id !== currentUser._id && !message.isRead
        );
        await Promise.allSettled(unreadIncoming.map((message) => markMessageAsReadInternal(message._id)));
      }
    } catch (err: any) {
      if (!String(err?.message || '').includes('not connected')) {
        throw err;
      }
      setMessages([]);
      setUnreadMessageIds([]);
    }
  }, [activePath, currentUser?._id, markMessageAsReadInternal, reconcileUnreadMessages]);

  const loadGallery = useCallback(async () => {
    const response = await api.get<{ media: MediaItem[] }>('/gallery');
    setGallery((response.media || []).filter((item) => !item.mediaType?.startsWith('audio/')));
  }, []);

  const loadMoments = useCallback(async () => {
    const response = await api.get<{ moments: Moment[] }>('/moments');
    setMoments(response.moments || []);
  }, []);

  const loadGoals = useCallback(async () => {
    const response = await api.get<{ goals: Goal[] }>('/goals');
    setGoals(response.goals || []);
  }, []);

  const loadCalls = useCallback(async () => {
    const response = await api.get<{ history: CallHistory[] }>('/calls/history');
    setCalls(response.history || []);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      await refreshProfile();
      await Promise.all([loadMessages(), loadGallery(), loadMoments(), loadGoals(), loadCalls()]);
    } catch (err: any) {
      setError(err.message || 'Failed to load app data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCalls, loadGallery, loadGoals, loadMessages, loadMoments, refreshProfile]);

  const refreshSecondaryData = useCallback(async () => {
    await Promise.allSettled([loadMessages(), loadGallery(), loadMoments(), loadGoals(), loadCalls()]);
  }, [loadCalls, loadGallery, loadGoals, loadMessages, loadMoments]);

  const bootstrapSignedInState = useCallback(async () => {
    if (!auth.currentUser || bootstrappingRef.current) return;

    bootstrappingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      await refreshProfile();

      InteractionManager.runAfterInteractions(() => {
        refreshSecondaryData()
          .catch((err: any) => {
            setError(err?.message || 'Failed to load app data');
          })
          .finally(() => {
            setIsLoading(false);
            bootstrappingRef.current = false;
          });
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load app data');
      setIsLoading(false);
      bootstrappingRef.current = false;
      throw err;
    }
  }, [refreshProfile, refreshSecondaryData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appVisibilityRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(UNREAD_STORAGE_KEY)
      .then((storedValue) => {
        if (!storedValue) return;
        const parsedIds = JSON.parse(storedValue);
        if (Array.isArray(parsedIds)) {
          setUnreadMessageIds(parsedIds.filter((value) => typeof value === 'string'));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        unreadLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!unreadLoadedRef.current) return;
    AsyncStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify(unreadMessageIds)).catch(() => undefined);
  }, [unreadMessageIds]);

  useEffect(() => {
    if (activePath === '/chat') {
      setUnreadMessageIds([]);
      setLatestChatNotification(null);
    }
  }, [activePath]);

  useEffect(() => {
    reconcileUnreadMessages(messages);
  }, [messages, reconcileUnreadMessages]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setIsInitializing(false);
      if (!user) {
        bootstrappingRef.current = false;
        setCurrentUser(null);
        setMessages([]);
        setGallery([]);
        setMoments([]);
        setGoals([]);
        setCalls([]);
        setUnreadMessageIds([]);
        setLatestChatNotification(null);
        socketRef.current?.disconnect();
        socketRef.current = null;
        return;
      }
      try {
        await bootstrapSignedInState();
      } catch {}
    });
    return unsubscribe;
  }, [bootstrapSignedInState]);

  useEffect(() => {
    if (!currentUser?._id) return;
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register-user', currentUser._id);
      if (currentUser.partnerId?._id) {
        socket.emit('update-activity', {
          userId: currentUser._id,
          partnerId: currentUser.partnerId._id,
          isActive: true,
        });
      }
    });

    socket.on('partner-online', ({ userId }) => {
      if (currentUser.partnerId?._id === userId) setPartnerOnline(true);
    });
    socket.on('partner-offline', ({ userId }) => {
      if (currentUser.partnerId?._id === userId) setPartnerOnline(false);
    });
    socket.on('partner-typing', ({ userId }) => {
      if (currentUser.partnerId?._id === userId) setPartnerTyping(true);
    });
    socket.on('partner-stop-typing', ({ userId }) => {
      if (currentUser.partnerId?._id === userId) setPartnerTyping(false);
    });
    socket.on('message:new', (incomingMessage: Message) => {
      if (
        incomingMessage.senderId?._id !== currentUser.partnerId?._id &&
        incomingMessage.recipientId?._id !== currentUser.partnerId?._id
      ) {
        return;
      }
      upsertMessage(incomingMessage);

      const isIncomingFromPartner = incomingMessage.senderId?._id === currentUser.partnerId?._id;
      const shouldTrackAsUnread = isIncomingFromPartner && activePath !== '/chat';

      if (isIncomingFromPartner && activePath === '/chat') {
        void markMessageAsReadInternal(incomingMessage._id);
      } else if (isIncomingFromPartner && appVisibilityRef.current === 'active') {
        void markMessageAsDeliveredInternal(incomingMessage._id);
      }

      if (shouldTrackAsUnread) {
        setUnreadMessageIds((prev) => {
          const nextIds = prev.includes(incomingMessage._id) ? prev : [...prev, incomingMessage._id];

          if (appVisibilityRef.current === 'active') {
            setLatestChatNotification({
              messageId: incomingMessage._id,
              senderName: currentUser.customPartnerName || currentUser.partnerId?.displayName || 'Partner',
              preview: getMessagePreview(incomingMessage),
              unreadCount: nextIds.length,
            });
          }

          return nextIds;
        });
      }
    });
    socket.on('message:sent', ({ clientTempId, message }: MessageDeliveryPayload) => {
      if (!message) return;
      setMessages((prev) => {
        const next = prev.map((item) => (clientTempId && item._id === clientTempId ? message : item));
        return next.some((item) => item._id === message._id)
          ? next
          : [...next, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    });
    socket.on('message:update', (incomingMessage: Message) => {
      upsertMessage(incomingMessage);
    });
    socket.on('message:delete', ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((message) => message._id !== messageId));
    });
    socket.on('incoming-call', (data: IncomingCall) => {
      setCallAcceptedAt(0);
      setActiveCallType(null);
      setIncomingCall(data);
      setLatestOfferSignal(null);
      setLatestAnswerSignal(null);
      setLatestIceCandidateSignal(null);
      router.push((data.callType === 'voice' ? '/voice' : '/video') as never);
    });
    socket.on('call-ended', async () => {
      setActiveCallType(null);
      setIncomingCall(null);
      setCallAcceptedAt(0);
      setLatestOfferSignal(null);
      setLatestAnswerSignal(null);
      setLatestIceCandidateSignal(null);
      await loadCalls();
    });
    socket.on('call-rejected', async () => {
      setActiveCallType(null);
      setIncomingCall(null);
      setCallAcceptedAt(0);
      setLatestOfferSignal(null);
      setLatestAnswerSignal(null);
      setLatestIceCandidateSignal(null);
      await loadCalls();
    });
    socket.on('call-accepted', async (data: { answer?: any; acceptedByUserId?: string; acceptedAt?: string }) => {
      setIncomingCall(null);
      setCallAcceptedAt(data?.acceptedAt ? new Date(data.acceptedAt).getTime() : Date.now());
      if (data?.answer && data.acceptedByUserId) {
        setLatestAnswerSignal({
          fromUserId: data.acceptedByUserId,
          answer: data.answer,
          signalId: `accepted-answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      await loadCalls();
    });
    socket.on('call-accepted-local', async (data: { acceptedAt?: string }) => {
      setCallAcceptedAt(data?.acceptedAt ? new Date(data.acceptedAt).getTime() : Date.now());
      await loadCalls();
    });
    socket.on('call-error', ({ message }: { message: string }) => {
      setError(message || 'Call failed');
      setActiveCallType(null);
      setIncomingCall(null);
      setCallAcceptedAt(0);
      setLatestOfferSignal(null);
      setLatestAnswerSignal(null);
      setLatestIceCandidateSignal(null);
    });
    socket.on('receive-offer', (data: { offer: any; fromUserId: string; callType?: 'voice' | 'video' }) => {
      setLatestOfferSignal({
        ...data,
        signalId: `offer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    });
    socket.on('receive-answer', (data: { answer: any; fromUserId: string }) => {
      setLatestAnswerSignal({
        ...data,
        signalId: `answer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    });
    socket.on('ice-candidate', (data: { candidate: any; fromUserId: string }) => {
      setLatestIceCandidateSignal({
        ...data,
        signalId: `ice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    });
    socket.on('partner-avatar-updated', async () => {
      await refreshProfile();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    activePath,
    currentUser?._id,
    currentUser?.customPartnerName,
    currentUser?.partnerId?._id,
    currentUser?.partnerId?.displayName,
    loadCalls,
    markMessageAsDeliveredInternal,
    markMessageAsReadInternal,
    refreshProfile,
    upsertMessage,
  ]);

  useEffect(() => {
    if (!authUser || !currentUser) return;
    const interval = setInterval(() => {
      loadMessages().catch(() => undefined);
      refreshProfile().catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [authUser, currentUser, loadMessages, refreshProfile]);

  const value = useMemo<AppStateValue>(
    () => ({
      authMode,
      isInitializing,
      isSignedIn,
      isLoading,
      authUser,
      currentUser,
      partner,
      messages,
      gallery,
      moments,
      goals,
      calls,
      partnerOnline,
      partnerTyping,
      activeCallType,
      incomingCall,
      callAcceptedAt,
      latestOfferSignal,
      latestAnswerSignal,
      latestIceCandidateSignal,
      unreadChatCount,
      latestChatNotification,
      error,
      setAuthMode,
      setActivePath: (path) => {
        setActivePathState(path);
        if (path === '/chat') {
          setUnreadMessageIds([]);
          setLatestChatNotification(null);
        }
      },
      dismissChatNotification: () => {
        setLatestChatNotification(null);
      },
      markConversationAsRead: async () => {
        if (!currentUser?._id) return;

        const unreadIncomingMessages = messages.filter(
          (message) => message.senderId?._id !== currentUser._id && !message.isRead
        );

        await Promise.allSettled(unreadIncomingMessages.map((message) => markMessageAsReadInternal(message._id)));
      },
      signIn: async (email, password) => {
        setIsLoading(true);
        setError(null);
        try {
          await signInWithEmail(email, password);
        } catch (err: any) {
          setError(err.message || 'Sign in failed');
          setIsLoading(false);
          throw err;
        }
      },
      signUp: async (name, email, password) => {
        setIsLoading(true);
        setError(null);
        try {
          await signUpWithEmail(name, email, password);
          await api.post('/auth/register', {});
        } catch (err: any) {
          setError(err.message || 'Sign up failed');
          setIsLoading(false);
          throw err;
        }
      },
      signOut: async () => {
        await signOutUser();
      },
      refreshAll,
      refreshProfile,
      sendMessage: async (text, replyTo) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
          _id: tempId,
          senderId: {
            _id: currentUser?._id || tempId,
            displayName: currentUser?.displayName || 'You',
            avatarUrl: currentUser?.avatarUrl,
          },
          recipientId: {
            _id: partner?._id || 'partner',
            displayName: partner?.displayName || 'Partner',
            avatarUrl: partner?.avatarUrl,
          },
          content: text,
          isRead: false,
          createdAt: new Date().toISOString(),
          replyTo: replyTo
            ? (messages.find((message) => message._id === replyTo)?.replyTo || messages.find((message) => message._id === replyTo)) as any
            : null,
          deliveryStatus: 'sent',
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        try {
          const response = await api.post<Message>('/messages', { content: text, replyTo, clientTempId: tempId });
          setMessages((prev) => prev.map((message) => (message._id === tempId ? response : message)));
        } catch (error) {
          setMessages((prev) => prev.filter((message) => message._id !== tempId));
          throw error;
        }
      },
      sendMediaMessage: async (asset, caption, replyTo) => {
        const uploadFormData = await buildFileFormData('file', asset, caption ? { caption } : undefined);
        const media = await api.post<MediaItem>('/gallery/upload', uploadFormData);
        const isVideoAttachment = media.mediaType?.startsWith('video/');
        const response = await api.post<Message>('/messages', {
          content: caption?.trim() || (isVideoAttachment ? 'Shared a video' : 'Shared a photo'),
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType,
          messageType: isVideoAttachment ? 'video' : 'image',
          replyTo,
        });
        upsertMessage(response);
        if (!media.mediaType?.startsWith('audio/')) {
          setGallery((prev) => (prev.some((item) => item._id === media._id) ? prev : [media, ...prev]));
        }
      },
      sendVoiceMessage: async (asset, replyTo) => {
        const tempId = `temp-audio-${Date.now()}`;
        const optimisticMessage: Message = {
          _id: tempId,
          senderId: {
            _id: currentUser?._id || tempId,
            displayName: currentUser?.displayName || 'You',
            avatarUrl: currentUser?.avatarUrl,
          },
          recipientId: {
            _id: partner?._id || 'partner',
            displayName: partner?.displayName || 'Partner',
            avatarUrl: partner?.avatarUrl,
          },
          content: '',
          mediaType: asset.mimeType || 'audio/m4a',
          isRead: false,
          createdAt: new Date().toISOString(),
          replyTo: replyTo
            ? (messages.find((message) => message._id === replyTo)?.replyTo || messages.find((message) => message._id === replyTo)) as any
            : null,
          deliveryStatus: 'sent',
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        const audioBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        try {
          const response = await api.post<Message>('/messages/audio', {
            audioBase64,
            mimeType: asset.mimeType || 'audio/m4a',
            fileName: asset.fileName || `voice-note-${Date.now()}.m4a`,
            replyTo,
            clientTempId: tempId,
          });

          setMessages((prev) => prev.map((message) => (message._id === tempId ? response : message)));
        } catch (error) {
          setMessages((prev) => prev.filter((message) => message._id !== tempId));
          throw error;
        }
      },
      editMessage: async (id, text) => {
        const response = await api.put<Message>(`/messages/${id}`, { content: text });
        setMessages((prev) => prev.map((message) => (message._id === id ? response : message)));
      },
      deleteMessage: async (id, deleteForEveryone) => {
        if (deleteForEveryone) {
          const response = await api.delete<Message>(`/messages/${id}/delete-for-everyone`);
          setMessages((prev) => prev.map((message) => (message._id === id ? response : message)));
          return;
        }

        await api.delete(`/messages/${id}/delete-for-me`);
        setMessages((prev) => prev.filter((message) => message._id !== id));
      },
      reactToMessage: async (id, emoji) => {
        const response = await api.post<Message>(`/messages/${id}/reactions`, { emoji });
        setMessages((prev) => prev.map((message) => (message._id === id ? response : message)));
      },
      removeReaction: async (id) => {
        const response = await api.delete<Message>(`/messages/${id}/reactions`);
        setMessages((prev) => prev.map((message) => (message._id === id ? response : message)));
      },
      generateInvitation: async (email) => {
        const response = await api.post<{ message: string; invitationLink?: string; emailSent?: boolean }>('/auth/generate-invitation', { partnerEmail: email });
        await refreshProfile();
        return response;
      },
      acceptInvitation: async (token) => {
        if (!token) return false;
        await api.post('/auth/accept-invitation', { invitationToken: token });
        await refreshAll();
        return true;
      },
      addMoment: async (title, description, date) => {
        await api.post('/moments', { title, description, date });
        await loadMoments();
      },
      deleteMoment: async (id) => {
        await api.delete(`/moments/${id}`);
        await loadMoments();
      },
      addGoal: async (title, description, targetDate) => {
        await api.post('/goals', { title, description, targetDate });
        await loadGoals();
      },
      toggleGoal: async (id, nextValue) => {
        const goal = goals.find((item) => item._id === id);
        if (!goal) return;
        await api.put(`/goals/${id}`, {
          title: goal.title,
          description: goal.description,
          targetDate: goal.targetDate,
          isCompleted: nextValue,
        });
        await loadGoals();
      },
      deleteGoal: async (id) => {
        await api.delete(`/goals/${id}`);
        await loadGoals();
      },
      updateCurrentUserName: async (name) => {
        await api.put('/auth/profile', { displayName: name });
        await refreshProfile();
      },
      updatePartnerNickname: async (name) => {
        await api.put('/auth/custom-partner-name', { customPartnerName: name });
        await refreshProfile();
      },
      uploadGalleryItem: async (asset, caption) => {
        const formData = await buildFileFormData('file', asset, { caption });
        await api.post('/gallery/upload', formData);
        await loadGallery();
      },
      deleteGalleryItem: async (id) => {
        await api.delete(`/gallery/${id}`);
        await loadGallery();
      },
      uploadAvatar: async (asset) => {
        const formData = await buildFileFormData('avatar', asset);
        await api.post('/auth/upload-avatar', formData);
        await refreshProfile();
      },
      startTyping: () => {
        if (!socketRef.current || !currentUser?.partnerId?._id) return;
        socketRef.current.emit('start-typing', { toUserId: currentUser.partnerId._id });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socketRef.current?.emit('stop-typing', { toUserId: currentUser.partnerId?._id });
        }, 1200);
      },
      stopTyping: () => {
        if (!socketRef.current || !currentUser?.partnerId?._id) return;
        socketRef.current.emit('stop-typing', { toUserId: currentUser.partnerId._id });
      },
      startCall: (type) => {
        setActiveCallType(type);
        setIncomingCall(null);
        setCallAcceptedAt(0);
        setLatestOfferSignal(null);
        setLatestAnswerSignal(null);
        setLatestIceCandidateSignal(null);
      },
      initiateCall: (toUserId, offer, type) => {
        if (!socketRef.current || !currentUser?._id) return;
        socketRef.current.emit('initiate-call', {
          fromUserId: currentUser._id,
          toUserId,
          offer,
          callType: type,
        });
      },
      acceptCall: (answer) => {
        if (!socketRef.current || !currentUser?._id || !incomingCall?.fromUserId) return;
        socketRef.current.emit('accept-call', {
          fromUserId: incomingCall.fromUserId,
          toUserId: currentUser._id,
          answer,
        });
        setActiveCallType(incomingCall.callType || 'video');
        setIncomingCall(null);
        setCallAcceptedAt(Date.now());
        loadCalls().catch(() => undefined);
      },
      rejectCall: () => {
        if (!socketRef.current || !currentUser?._id || !incomingCall?.fromUserId) return;
        socketRef.current.emit('reject-call', {
          fromUserId: incomingCall.fromUserId,
          toUserId: currentUser._id,
        });
        setIncomingCall(null);
        setActiveCallType(null);
        loadCalls().catch(() => undefined);
      },
      endCall: () => {
        if (!socketRef.current || !currentUser?._id || !currentUser.partnerId?._id) return;
        socketRef.current.emit('end-call', {
          fromUserId: currentUser._id,
          toUserId: currentUser.partnerId._id,
        });
        setActiveCallType(null);
        setCallAcceptedAt(0);
        loadCalls().catch(() => undefined);
      },
      sendOffer: (toUserId, offer, callType) => {
        if (!socketRef.current) return;
        socketRef.current.emit('send-offer', {
          toUserId,
          offer,
          callType,
        });
      },
      sendAnswer: (toUserId, answer) => {
        if (!socketRef.current) return;
        socketRef.current.emit('send-answer', {
          toUserId,
          answer,
        });
      },
      sendIceCandidate: (toUserId, candidate) => {
        if (!socketRef.current) return;
        socketRef.current.emit('ice-candidate', {
          toUserId,
          candidate,
        });
      },
    }),
    [
      activeCallType,
      authMode,
      authUser,
      callAcceptedAt,
      calls,
      currentUser,
      error,
      gallery,
      goals,
      incomingCall,
      isInitializing,
      isLoading,
      isSignedIn,
      latestAnswerSignal,
      latestChatNotification,
      latestIceCandidateSignal,
      latestOfferSignal,
      loadCalls,
      loadGallery,
      loadGoals,
      loadMoments,
      markMessageAsReadInternal,
      messages,
      moments,
      partner,
      partnerOnline,
      partnerTyping,
      refreshAll,
      refreshProfile,
      unreadChatCount,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
