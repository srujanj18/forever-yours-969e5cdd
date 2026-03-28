import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Platform } from 'react-native';
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

type IncomingCall = {
  fromUserId: string;
  fromUserName?: string;
  offer: any;
  callType?: 'voice' | 'video';
  callId?: string;
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
  error: string | null;
  setAuthMode: (mode: AuthMode) => void;
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
  generateInvitation: (email: string) => Promise<void>;
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
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

async function buildFileFormData(fieldName: string, asset: UploadAsset, extra?: Record<string, string>) {
  const formData = new FormData();
  const normalizedType = asset.type || (asset.mimeType?.startsWith('video') ? 'video' : asset.mimeType?.startsWith('audio') ? 'audio' : 'image');
  const fileName =
    asset.fileName ||
    `${fieldName}.${normalizedType === 'video' ? 'mp4' : normalizedType === 'audio' ? 'm4a' : 'jpg'}`;
  const mimeType =
    asset.mimeType ||
    (normalizedType === 'video' ? 'video/mp4' : normalizedType === 'audio' ? 'audio/m4a' : 'image/jpeg');

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(asset.uri);
    const blob = await fileResponse.blob();
    formData.append(fieldName, blob, fileName);
  } else {
    formData.append(fieldName, {
      uri: asset.uri,
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
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const partner = currentUser?.partnerId || null;
  const isSignedIn = !!authUser;

  const refreshProfile = useCallback(async () => {
    const response = await api.get<{ user: UserProfile }>('/auth/profile');
    setCurrentUser(response.user);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const response = await api.get<Message[]>('/messages');
      setMessages(response);
    } catch (err: any) {
      if (!String(err?.message || '').includes('not connected')) {
        throw err;
      }
      setMessages([]);
    }
  }, []);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setIsInitializing(false);
      if (!user) {
        setCurrentUser(null);
        setMessages([]);
        setGallery([]);
        setMoments([]);
        setGoals([]);
        setCalls([]);
        socketRef.current?.disconnect();
        socketRef.current = null;
        return;
      }
      try {
        await refreshAll();
      } catch {}
    });
    return unsubscribe;
  }, [refreshAll]);

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
    socket.on('incoming-call', (data: IncomingCall) => {
      setIncomingCall(data);
      router.push('/video' as never);
    });
    socket.on('call-ended', async () => {
      setActiveCallType(null);
      setIncomingCall(null);
      await loadCalls();
    });
    socket.on('call-rejected', async () => {
      setActiveCallType(null);
      setIncomingCall(null);
      await loadCalls();
    });
    socket.on('call-accepted', async () => {
      setIncomingCall(null);
      await loadCalls();
    });
    socket.on('call-error', ({ message }: { message: string }) => {
      setError(message || 'Call failed');
      setActiveCallType(null);
      setIncomingCall(null);
    });
    socket.on('partner-avatar-updated', async () => {
      await refreshProfile();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?._id, currentUser?.partnerId?._id, loadCalls, refreshProfile]);

  useEffect(() => {
    if (!authUser || !currentUser) return;
    const interval = setInterval(() => {
      loadMessages().catch(() => undefined);
      refreshProfile().catch(() => undefined);
    }, 4000);
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
      error,
      setAuthMode,
      signIn: async (email, password) => {
        setIsLoading(true);
        setError(null);
        try {
          await signInWithEmail(email, password);
          await refreshAll();
        } catch (err: any) {
          setError(err.message || 'Sign in failed');
          throw err;
        } finally {
          setIsLoading(false);
        }
      },
      signUp: async (name, email, password) => {
        setIsLoading(true);
        setError(null);
        try {
          await signUpWithEmail(name, email, password);
          await api.post('/auth/register', {});
          await refreshAll();
        } catch (err: any) {
          setError(err.message || 'Sign up failed');
          throw err;
        } finally {
          setIsLoading(false);
        }
      },
      signOut: async () => {
        await signOutUser();
      },
      refreshAll,
      refreshProfile,
      sendMessage: async (text, replyTo) => {
        const response = await api.post<Message>('/messages', { content: text, replyTo });
        setMessages((prev) => [...prev, response]);
      },
      sendMediaMessage: async (asset, caption, replyTo) => {
        const uploadFormData = await buildFileFormData('file', asset, caption ? { caption } : undefined);
        const media = await api.post<MediaItem>('/gallery/upload', uploadFormData);
        const response = await api.post<Message>('/messages', {
          content: caption?.trim() || undefined,
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType,
          replyTo,
        });
        setMessages((prev) => [...prev, response]);
        if (!media.mediaType?.startsWith('audio/')) {
          setGallery((prev) => [media, ...prev]);
        }
      },
      sendVoiceMessage: async (asset, replyTo) => {
        const audioBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const response = await api.post<Message>('/messages/audio', {
          audioBase64,
          mimeType: asset.mimeType || 'audio/m4a',
          fileName: asset.fileName || `voice-note-${Date.now()}.m4a`,
          replyTo,
        });

        setMessages((prev) => [...prev, response]);
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
        await api.post('/auth/generate-invitation', { partnerEmail: email });
        await refreshProfile();
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
        if (!socketRef.current || !currentUser?._id || !currentUser.partnerId?._id) return;
        setActiveCallType(type);
        setIncomingCall(null);
        socketRef.current.emit('initiate-call', {
          fromUserId: currentUser._id,
          toUserId: currentUser.partnerId._id,
          offer: null,
          callType: type,
        });
      },
      acceptCall: () => {
        if (!socketRef.current || !currentUser?._id || !incomingCall?.fromUserId) return;
        socketRef.current.emit('accept-call', {
          fromUserId: incomingCall.fromUserId,
          toUserId: currentUser._id,
          answer: incomingCall.offer ?? null,
        });
        setActiveCallType(incomingCall.callType || 'video');
        setIncomingCall(null);
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
        loadCalls().catch(() => undefined);
      },
    }),
    [
      activeCallType,
      authMode,
      authUser,
      calls,
      currentUser,
      error,
      gallery,
      goals,
      incomingCall,
      isInitializing,
      isLoading,
      isSignedIn,
      loadCalls,
      loadGallery,
      loadGoals,
      loadMoments,
      messages,
      moments,
      partner,
      partnerOnline,
      partnerTyping,
      refreshAll,
      refreshProfile,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
