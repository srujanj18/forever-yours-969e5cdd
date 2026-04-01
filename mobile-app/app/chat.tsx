import * as ImagePicker from 'expo-image-picker';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { ArrowLeft, CalendarDays, Check, CheckCheck, ChevronDown, Copy, Image as ImageIcon, Link2, Mic, Pause, Pencil, Phone, Play, Reply, RotateCcw, Search, Send, Square, Trash2, Users, Video } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Image, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AppButton, AppShell, AvatarBadge, Card, EmptyState, FormModal, IconButton, ProfileShortcut, theme } from '../components/app-ui';
import { resolveAssetUrl } from '../lib/api';
import { useAppState } from '../lib/app-state';
import type { Message } from '../lib/types';

async function applyPlaybackAudioMode() {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

async function applyRecordingAudioMode() {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

async function resetAudioMode() {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

const REACTION_EMOJIS = ['❤️', '😍', '😂', '😮', '😢', '🙏'];

function isGeneratedMediaCaption(message?: Pick<Message, 'content' | 'mediaType'> | null) {
  if (!message?.mediaType || !message.content?.trim()) return false;

  const content = message.content.trim().toLowerCase();
  return content === 'shared a photo' || content === 'shared a video';
}

function getMessagePreview(message?: Pick<Message, 'content' | 'mediaType'> | null) {
  if (!message) return '';
  if (message.content?.trim() && !isGeneratedMediaCaption(message)) return message.content;
  return message.mediaType?.startsWith('video') ? 'Video attachment' : 'Photo attachment';
}

function MessageStatusIcon({ message }: { message: Message }) {
  const status = message.deliveryStatus || (message.isRead ? 'read' : 'sent');
  const iconColor = status === 'read' ? '#22c55e' : 'rgba(255,255,255,0.75)';

  if (status === 'delivered' || status === 'read') {
    return <CheckCheck size={14} color={iconColor} />;
  }

  return <Check size={14} color="rgba(255,255,255,0.75)" />;
}

function SwipeableMessage({
  onReply,
  onLongPress,
  onPress,
  children,
}: {
  onReply: () => void;
  onLongPress: () => void;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        const nextX = Math.min(Math.max(gestureState.dx, 0), 96);
        translateX.setValue(nextX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 72) onReply();
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 6,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable onPress={onPress} onLongPress={onLongPress}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

type PendingMedia = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
  originalUri: string;
  revokeUriOnClose?: boolean;
};

function MenuRow({
  label,
  icon,
  onPress,
  danger,
  muted,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={muted}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: pressed && !muted ? 'rgba(108,99,255,0.18)' : 'transparent',
          opacity: muted ? 0.55 : 1,
        },
      ]}
    >
      {icon}
      <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function ChatScreen() {
  const {
    currentUser,
    partner,
    messages,
    sendMessage,
    sendMediaMessage,
    sendVoiceMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    removeReaction,
    generateInvitation,
    partnerOnline,
    partnerTyping,
    startTyping,
    stopTyping,
    startCall,
    markConversationAsRead,
  } = useAppState();

  const [draft, setDraft] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [editingMessageId, setEditingMessageId] = useState<string | undefined>();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [pendingMediaCaption, setPendingMediaCaption] = useState('');
  const [isSendingPendingMedia, setIsSendingPendingMedia] = useState(false);
  const [isCallMenuVisible, setIsCallMenuVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const messageLayoutsRef = useRef<Record<string, number>>({});
  const activeSoundRef = useRef<Audio.Sound | null>(null);
  const previousMessageCountRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  const partnerLabel = currentUser?.customPartnerName || partner?.displayName || 'Partner';
  const replyingMessage = useMemo(() => messages.find((message) => message._id === replyTo), [messages, replyTo]);
  const editingMessage = useMemo(() => messages.find((message) => message._id === editingMessageId), [editingMessageId, messages]);
  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return messages.filter((message) => {
      const content = message.content?.toLowerCase() || '';
      const replyContent = message.replyTo?.content?.toLowerCase() || '';
      return content.includes(query) || replyContent.includes(query);
    });
  }, [messages, searchQuery]);

  const closeMessageActions = () => {
    setSelectedMessage(null);
  };

  const closeSearch = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
  };

  const closePendingMedia = () => {
    setPendingMedia((current) => {
      if (current?.revokeUriOnClose && current.uri.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(current.uri);
      }
      return null;
    });
    setPendingMediaCaption('');
    setIsSendingPendingMedia(false);
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  };

  const jumpToMessage = (messageId: string) => {
    const y = messageLayoutsRef.current[messageId];
    setHighlightedMessageId(messageId);
    closeSearch();
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true });
    }
    setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, 2200);
  };

  useEffect(() => {
    void resetAudioMode();

    return () => {
      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => undefined);
      }
      if (activeSoundRef.current) {
        void activeSoundRef.current.unloadAsync().catch(() => undefined);
      }
      void resetAudioMode().catch(() => undefined);
    };
  }, [recording]);

  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      scrollToBottom(previousMessageCountRef.current > 0);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void markConversationAsRead();
  }, [markConversationAsRead, messages.length]);

  const openCallScreen = (type: 'voice' | 'video') => {
    setIsCallMenuVisible(false);
    if (type === 'voice') {
      startCall(type);
      router.push('/voice' as never);
      return;
    }

    router.push('/video' as never);
  };

  const applyImageEdit = async (action: 'rotate' | 'flip' | 'reset') => {
    if (!pendingMedia || pendingMedia.type !== 'image') return;

    try {
      if (action === 'reset') {
        setPendingMedia((current) => (current ? { ...current, uri: current.originalUri } : current));
        return;
      }

      const actions =
        action === 'rotate'
          ? [{ rotate: 90 as const }]
          : [{ flip: ImageManipulator.FlipType.Horizontal }];

      const result = await ImageManipulator.manipulateAsync(pendingMedia.uri, actions, {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      setPendingMedia((current) =>
        current
          ? {
              ...current,
              uri: result.uri,
              mimeType: 'image/jpeg',
              fileName: current.fileName?.replace(/\.\w+$/, '.jpg') || `edited-photo-${Date.now()}.jpg`,
            }
          : current
      );
    } catch (error: any) {
      Alert.alert('Edit unavailable', error?.message || 'Unable to update this media right now.');
    }
  };

  const startVoiceNoteRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Allow microphone access to record voice notes.');
        return;
      }

      await applyRecordingAudioMode();

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setIsRecordingVoiceNote(true);
    } catch (error: any) {
      Alert.alert('Recording unavailable', error?.message || 'Unable to start voice note recording right now.');
    }
  };

  const stopVoiceNoteRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecordingVoiceNote(false);

      await resetAudioMode();

      if (!uri) {
        Alert.alert('Recording unavailable', 'We could not save that voice note. Please try again.');
        return;
      }

      await sendVoiceMessage(
        {
          uri,
          fileName: `voice-note-${Date.now()}.m4a`,
          mimeType: 'audio/m4a',
          type: 'audio',
        },
        replyTo
      );
      setReplyTo(undefined);
      setEditingMessageId(undefined);
      stopTyping();
    } catch (error: any) {
      setRecording(null);
      setIsRecordingVoiceNote(false);
      Alert.alert('Voice note failed', error?.message || 'Unable to send your voice note right now.');
    }
  };

  const toggleAudioPlayback = async (messageId: string, mediaPath?: string | null) => {
    const source = resolveAssetUrl(mediaPath);
    if (!source) return;

    try {
      if (recording || isRecordingVoiceNote) {
        Alert.alert('Playback unavailable', 'Finish recording your voice note before playing audio.');
        return;
      }

      if (appStateRef.current !== 'active') {
        Alert.alert('Playback unavailable', 'Open the chat and keep the app in front before playing a voice note.');
        return;
      }

      await applyPlaybackAudioMode();

      if (playingAudioId === messageId && activeSoundRef.current) {
        await activeSoundRef.current.stopAsync();
        await activeSoundRef.current.unloadAsync();
        activeSoundRef.current = null;
        setPlayingAudioId(null);
        await resetAudioMode();
        return;
      }

      if (activeSoundRef.current) {
        await activeSoundRef.current.stopAsync();
        await activeSoundRef.current.unloadAsync();
        activeSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: source },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status) => {
          if (!status.isLoaded) {
            if ('error' in status && status.error) {
              setPlayingAudioId(null);
            }
            return;
          }

          if (status.didJustFinish) {
            setPlayingAudioId(null);
            if (activeSoundRef.current) {
              void activeSoundRef.current.unloadAsync().catch(() => undefined);
              activeSoundRef.current = null;
            }
            void resetAudioMode().catch(() => undefined);
          }
        }
      );

      activeSoundRef.current = sound;
      setPlayingAudioId(messageId);
    } catch (error: any) {
      Alert.alert('Playback failed', error?.message || 'Unable to play this voice note right now.');
      setPlayingAudioId(null);
      await resetAudioMode().catch(() => undefined);
    }
  };

  const openMedia = async (mediaUrl?: string | null, mediaType?: string | null) => {
    const resolvedUrl = resolveAssetUrl(mediaUrl);
    if (!resolvedUrl) return;

    if (mediaType?.startsWith('video/')) {
      await Linking.openURL(resolvedUrl);
      return;
    }

    setActiveMediaUrl(resolvedUrl);
    setActiveMediaType(mediaType || 'image/jpeg');
  };

  const pickAndSendMedia = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        const kind = file.type.startsWith('video/') ? 'video' : 'image';

        setPendingMedia((current) => {
          if (current?.revokeUriOnClose && current.uri.startsWith('blob:')) {
            URL.revokeObjectURL(current.uri);
          }

          return {
            uri: objectUrl,
            originalUri: objectUrl,
            type: kind,
            mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
            fileName: file.name,
            revokeUriOnClose: true,
          };
        });
        setPendingMediaCaption(draft.trim());
      };

      input.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Media access needed', 'Allow photo library access to send media in chat.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const kind = asset.type === 'video' ? 'video' : 'image';
    setPendingMedia({
      uri: asset.uri,
      originalUri: asset.uri,
      type: kind,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      revokeUriOnClose: false,
    });
    setPendingMediaCaption(draft.trim());
  };

  const sendPendingMedia = async () => {
    if (!pendingMedia) return;

    try {
      setIsSendingPendingMedia(true);
      await sendMediaMessage(
        {
          uri: pendingMedia.uri,
          fileName: pendingMedia.fileName,
          mimeType:
            pendingMedia.mimeType ||
            (pendingMedia.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          type: pendingMedia.type,
        },
        pendingMediaCaption.trim() || undefined,
        replyTo
      );
      setDraft('');
      setReplyTo(undefined);
      setEditingMessageId(undefined);
      stopTyping();
      closePendingMedia();
    } catch (error: any) {
      setIsSendingPendingMedia(false);
      Alert.alert('Upload failed', error?.message || 'Unable to share media right now.');
    }
  };

  const submitComposer = async () => {
    const nextMessage = draft.trim();
    if (!nextMessage) return;
    const currentReplyTo = replyTo;

    try {
      if (editingMessageId) {
        await editMessage(editingMessageId, nextMessage);
        setEditingMessageId(undefined);
      } else {
        setDraft('');
        setReplyTo(undefined);
        stopTyping();
        await sendMessage(nextMessage, currentReplyTo);
        return;
      }
      setDraft('');
      stopTyping();
    } catch (error: any) {
      if (!editingMessageId) {
        setDraft(nextMessage);
        if (currentReplyTo) setReplyTo(currentReplyTo);
      }
      Alert.alert('Message failed', error?.message || 'Unable to send your message right now.');
    }
  };

  const beginReply = (message: Message) => {
    setReplyTo(message._id);
    setEditingMessageId(undefined);
    closeMessageActions();
  };

  const beginEdit = (message: Message) => {
    setDraft(message.content);
    setEditingMessageId(message._id);
    setReplyTo(undefined);
    closeMessageActions();
  };

  const handleDelete = async (message: Message, deleteForEveryone?: boolean) => {
    try {
      await deleteMessage(message._id, deleteForEveryone);
      if (replyTo === message._id) setReplyTo(undefined);
      if (editingMessageId === message._id) {
        setEditingMessageId(undefined);
        setDraft('');
      }
      closeMessageActions();
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Unable to delete this message right now.');
    }
  };

  const handleReaction = async (message: Message, emoji: string) => {
    const existingReaction = message.reactions?.find((reaction) => reaction.userId._id === currentUser?._id);

    try {
      if (existingReaction?.emoji === emoji) {
        await removeReaction(message._id);
      } else {
        await reactToMessage(message._id, emoji);
      }
      closeMessageActions();
    } catch (error: any) {
      Alert.alert('Reaction failed', error?.message || 'Unable to update your reaction.');
    }
  };

  const handleCopyMessage = async (message: Message) => {
    const textToCopy = getMessagePreview(message);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        closeMessageActions();
        return;
      }
      Alert.alert('Copy unavailable', textToCopy);
    } catch (error: any) {
      Alert.alert('Copy failed', error?.message || 'Unable to copy this message right now.');
    }
  };

  if (!currentUser) {
    return (
      <AppShell title="Chat" subtitle="Loading conversation...">
        <Card>
          <Text style={{ color: theme.secondaryText }}>Loading your chat...</Text>
        </Card>
      </AppShell>
    );
  }

  if (!partner) {
    return (
      <AppShell title="Chat" subtitle="Invite your partner to unlock the conversation">
        <Card>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Connect with your partner</Text>
          <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>
            This mirrors the invite-first flow from the web chat page.
          </Text>
          <TextInput
            value={partnerEmail}
            onChangeText={setPartnerEmail}
            placeholder="partner@example.com"
            placeholderTextColor={theme.secondaryText}
            style={{ minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 16, color: theme.text }}
          />
          <AppButton
            title="Send Invitation"
            onPress={async () => {
              try {
                const response = await generateInvitation(partnerEmail);
                Alert.alert(
                  response.emailSent ? 'Invitation sent' : 'Share this invitation link',
                  response.emailSent
                    ? response.message
                    : `${response.message}\n\n${response.invitationLink || ''}`
                );
              } catch (error: any) {
                Alert.alert('Invitation failed', error?.message || 'Unable to create the invitation right now.');
              }
            }}
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell
        title={undefined}
        subtitle={undefined}
        scroll={false}
        autoBack={false}
      >
        <View style={{ flex: 1, gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 22,
              paddingHorizontal: 10,
              paddingVertical: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <IconButton
                label="Back"
                onPress={() => router.back()}
                icon={<ArrowLeft size={16} color={theme.text} />}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
              <Pressable onPress={() => router.push('/partner-profile' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <AvatarBadge label={partnerLabel} size={38} color={theme.pink} />
                <View style={{ gap: 2, flexShrink: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }} numberOfLines={1}>{partnerLabel}</Text>
                  <Text style={{ color: theme.secondaryText, fontSize: 11 }} numberOfLines={2}>
                    {partnerTyping ? 'Typing...' : partnerOnline ? 'Online now' : 'Offline right now'}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                onPress={() => setIsCallMenuVisible(true)}
                style={{
                  minWidth: 72,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  paddingHorizontal: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Video size={15} color={theme.text} />
                <ChevronDown size={14} color={theme.secondaryText} />
              </Pressable>
              <IconButton
                label="Search"
                onPress={() => setIsSearchVisible(true)}
                icon={<Search size={16} color={theme.text} />}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
              <IconButton
                label="Profile"
                onPress={() => router.push('/profile' as never)}
                icon={<Users size={16} color={theme.rose} />}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {messages.length === 0 ? <EmptyState title="No messages yet" subtitle="Start the thread and make this space feel lived in." /> : null}
            {messages.map((message) => {
              const own = message.senderId?._id === currentUser._id;
              const reply = message.replyTo || undefined;
              const isAudio = message.mediaType?.startsWith('audio');
              const isVideo = message.mediaType?.startsWith('video');
              const mediaUrl = resolveAssetUrl(message.mediaUrl);
              const hasCaption = !!message.content?.trim() && !isGeneratedMediaCaption(message);
              const isHighlighted = highlightedMessageId === message._id;
              const bubbleBackground = isHighlighted ? '#1B1D4E' : own ? 'rgba(108, 99, 255, 0.22)' : theme.surface;
              const bubbleTextColor = own ? theme.text : theme.text;
              const bubbleMetaColor = own ? theme.secondaryText : theme.secondaryText;
              const bubbleBorderWidth = 0;
              const bubbleBorderColor = 'transparent';
              const replyBorderColor = isHighlighted ? theme.green : own ? theme.rose : theme.pink;
              const mediaCardBackground = isHighlighted ? '#2A2D67' : own ? '#5148e5' : '#1B1D4E';
              const reactionBackground = isHighlighted ? '#2A2D67' : own ? '#5148e5' : theme.mutedSurface;
              const mediaBubblePadding = mediaUrl && !isAudio ? 4 : 12;
              const messageTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <SwipeableMessage
                  key={message._id}
                  onReply={() => beginReply(message)}
                  onLongPress={() => setSelectedMessage(message)}
                  onPress={() => setSelectedMessage(message)}
                >
                  <View
                    onLayout={(event) => {
                      messageLayoutsRef.current[message._id] = event.nativeEvent.layout.y;
                    }}
                    style={{ alignItems: own ? 'flex-end' : 'flex-start' }}
                  >
                    {!own ? <Text style={{ fontSize: 12, color: theme.secondaryText, marginBottom: 4 }}>{partnerLabel}</Text> : null}
                    <View
                      style={{
                        maxWidth: '84%',
                        borderRadius: 20,
                        paddingHorizontal: mediaBubblePadding,
                        paddingVertical: mediaBubblePadding,
                        backgroundColor: bubbleBackground,
                        borderWidth: bubbleBorderWidth,
                        borderColor: bubbleBorderColor,
                        gap: 8,
                      }}
                    >
                      {reply ? (
                        <View style={{ borderLeftWidth: 3, borderLeftColor: replyBorderColor, paddingLeft: 8 }}>
                          <Text style={{ fontSize: 12, color: bubbleMetaColor }} numberOfLines={2}>
                            {getMessagePreview(reply)}
                          </Text>
                        </View>
                      ) : null}

                      {mediaUrl ? (
                        <View style={{ gap: hasCaption ? 8 : 0 }}>
                          {isAudio ? (
                            <Pressable onPress={() => void toggleAudioPlayback(message._id, message.mediaUrl)}>
                              <View
                                style={{
                                  width: 248,
                                  minHeight: 72,
                                  borderRadius: 18,
                                  backgroundColor: own ? '#1d4ed8' : '#e9eff7',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 12,
                                  paddingHorizontal: 14,
                                  paddingVertical: 12,
                                }}
                              >
                                <View
                                  style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 21,
                                    backgroundColor: own ? 'rgba(255,255,255,0.18)' : '#d4deea',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {playingAudioId === message._id ? <Pause size={18} color={own ? '#fff' : theme.text} /> : <Play size={18} color={own ? '#fff' : theme.text} />}
                                </View>
                                <View style={{ flex: 1, gap: 6 }}>
                                  <Text style={{ color: own ? '#fff' : theme.text, fontWeight: '700' }}>Voice note</Text>
                                  <View style={{ height: 4, borderRadius: 999, backgroundColor: own ? 'rgba(255,255,255,0.26)' : '#c2cfdd', overflow: 'hidden' }}>
                                    <View style={{ width: playingAudioId === message._id ? '70%' : '38%', height: '100%', borderRadius: 999, backgroundColor: own ? '#fff' : theme.rose }} />
                                  </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Text style={{ fontSize: 11, color: own ? '#dbeafe' : theme.secondaryText }}>{messageTime}</Text>
                                  {own ? <MessageStatusIcon message={message} /> : null}
                                </View>
                              </View>
                            </Pressable>
                          ) : (
                            <Pressable onPress={() => void openMedia(message.mediaUrl, message.mediaType)}>
                              <View style={{ width: 248, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: mediaCardBackground }}>
                                {isVideo ? (
                                  <View style={{ height: 176, backgroundColor: mediaCardBackground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                                    <Video size={34} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700', marginTop: 10 }}>Video attachment</Text>
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 6 }}>
                                      Tap to open and watch this video.
                                    </Text>
                                  </View>
                                ) : (
                                  <Image
                                    source={{ uri: mediaUrl }}
                                    resizeMode="cover"
                                    style={{ width: 248, height: 176, backgroundColor: mediaCardBackground }}
                                  />
                                )}

                                <View
                                  style={{
                                    position: 'absolute',
                                    right: 8,
                                    bottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                  backgroundColor: 'rgba(10, 11, 46, 0.7)',
                                  }}
                                >
                                  <Text style={{ fontSize: 11, color: '#fff' }}>{messageTime}</Text>
                                  {own ? <MessageStatusIcon message={message} /> : null}
                                </View>
                              </View>
                            </Pressable>
                          )}

                          {hasCaption ? (
                            <Text style={{ color: bubbleTextColor, lineHeight: 20, paddingHorizontal: 8, paddingBottom: 4 }}>{message.content}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      {!mediaUrl && hasCaption ? <Text style={{ color: bubbleTextColor, lineHeight: 20 }}>{message.content}</Text> : null}

                      {message.reactions?.length ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {message.reactions.map((reaction, index) => (
                            <View key={`${reaction.userId._id}-${reaction.emoji}-${index}`} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: reactionBackground }}>
                              <Text style={{ fontSize: 12 }}>{reaction.emoji}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {(!mediaUrl || hasCaption) && !isAudio ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignItems: 'center', paddingHorizontal: mediaUrl ? 8 : 0, paddingBottom: mediaUrl ? 4 : 0 }}>
                          {message.isEdited ? <Text style={{ fontSize: 11, color: bubbleMetaColor }}>edited</Text> : null}
                          <Text style={{ fontSize: 11, color: bubbleMetaColor, textAlign: 'right' }}>{messageTime}</Text>
                          {own ? <MessageStatusIcon message={message} /> : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </SwipeableMessage>
              );
            })}
          </ScrollView>

          {replyingMessage ? (
            <Card style={{ backgroundColor: theme.mutedSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.rose, fontWeight: '700' }}>Replying to message</Text>
                <Text style={{ color: theme.secondaryText }} numberOfLines={1}>
                  {getMessagePreview(replyingMessage)}
                </Text>
              </View>
              <IconButton label="Cancel reply" onPress={() => setReplyTo(undefined)} icon={<ArrowLeft size={18} color={theme.rose} />} />
            </Card>
          ) : null}

          {editingMessage ? (
            <Card style={{ backgroundColor: theme.mutedSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.rose, fontWeight: '700' }}>Editing message</Text>
                <Text style={{ color: theme.secondaryText }} numberOfLines={1}>
                  {getMessagePreview(editingMessage)}
                </Text>
              </View>
              <IconButton
                label="Cancel edit"
                onPress={() => {
                  setEditingMessageId(undefined);
                  setDraft('');
                }}
                icon={<ArrowLeft size={18} color={theme.rose} />}
              />
            </Card>
          ) : null}

          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <IconButton label="Share media" onPress={() => void pickAndSendMedia()} icon={<ImageIcon size={18} color={theme.rose} />} />
            {isRecordingVoiceNote ? (
              <View style={{ flex: 1, minHeight: 46, borderRadius: 18, backgroundColor: theme.mutedSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.danger }} />
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Recording voice note...</Text>
                </View>
                <Pressable
                  onPress={() => void stopVoiceNoteRecording()}
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.rose, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Square size={16} color="#fff" fill="#fff" />
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  value={draft}
                  onChangeText={(value) => {
                    setDraft(value);
                    if (editingMessageId) return;
                    if (value.trim()) startTyping();
                    else stopTyping();
                  }}
                  placeholder={editingMessageId ? 'Edit your message...' : 'Share your love...'}
                  placeholderTextColor={theme.secondaryText}
                  multiline
                  style={{ flex: 1, maxHeight: 100, color: theme.text, paddingVertical: 8 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => void startVoiceNoteRecording()}
                    style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.mutedSurface, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Mic size={18} color={theme.rose} />
                  </Pressable>
                  <Pressable
                    onPress={() => void submitComposer()}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: draft.trim() || editingMessageId ? theme.rose : '#3A3E7A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={18} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </AppShell>

      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={closeMessageActions}>
        <Pressable onPress={closeMessageActions} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.38)', justifyContent: 'center', paddingHorizontal: 18 }}>
          {selectedMessage ? (
            <Pressable
              onPress={() => undefined}
              style={{
                alignSelf: selectedMessage.senderId._id === currentUser._id ? 'flex-end' : 'flex-start',
                width: '82%',
                maxWidth: 340,
                gap: 10,
              }}
            >
              <View style={{ borderRadius: 999, backgroundColor: theme.surface, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.border }}>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => void handleReaction(selectedMessage, emoji)}
                    style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent' }]}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ borderRadius: 24, backgroundColor: theme.surface, paddingVertical: 8, borderWidth: 1, borderColor: theme.border }}>
                <MenuRow label="Reply" icon={<Reply size={18} color={theme.text} />} onPress={() => beginReply(selectedMessage)} />
                <MenuRow label="Copy" icon={<Copy size={18} color={theme.text} />} onPress={() => void handleCopyMessage(selectedMessage)} />
                {selectedMessage.senderId._id === currentUser._id && !selectedMessage.isDeleted ? (
                  <MenuRow label="Edit" icon={<Pencil size={18} color={theme.text} />} onPress={() => beginEdit(selectedMessage)} />
                ) : null}
                {selectedMessage.senderId._id === currentUser._id ? (
                  <>
                    <MenuRow label="Delete for everyone" icon={<Trash2 size={18} color={theme.danger} />} onPress={() => void handleDelete(selectedMessage, true)} danger />
                    <MenuRow label="Delete for me" icon={<Trash2 size={18} color={theme.danger} />} onPress={() => void handleDelete(selectedMessage, false)} danger />
                  </>
                ) : (
                  <MenuRow label="Delete" icon={<Trash2 size={18} color={theme.danger} />} onPress={() => void handleDelete(selectedMessage, false)} danger />
                )}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={isCallMenuVisible} transparent animationType="fade" onRequestClose={() => setIsCallMenuVisible(false)}>
        <Pressable onPress={() => setIsCallMenuVisible(false)} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.28)', paddingHorizontal: 18, paddingTop: 88 }}>
          <Pressable
            onPress={() => undefined}
            style={{
              alignSelf: 'flex-end',
              width: 320,
              maxWidth: '100%',
              borderRadius: 28,
              backgroundColor: theme.surface,
              padding: 18,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarBadge label={partnerLabel} size={48} color={theme.pink} />
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {partnerLabel}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => openCallScreen('voice')}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 999,
                  backgroundColor: theme.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Phone size={18} color="#0A0B2E" />
                <Text style={{ color: '#0A0B2E', fontSize: 17, fontWeight: '800' }}>Voice</Text>
              </Pressable>
              <Pressable
                onPress={() => openCallScreen('video')}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 999,
                  backgroundColor: theme.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Video size={18} color="#0A0B2E" />
                <Text style={{ color: '#0A0B2E', fontSize: 17, fontWeight: '800' }}>Video</Text>
              </Pressable>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />

            <MenuRow
              label="New group call"
              onPress={() => undefined}
              muted
              icon={<Users size={18} color={theme.text} />}
            />
            <MenuRow
              label="Send call link"
              onPress={() => undefined}
              muted
              icon={<Link2 size={18} color={theme.text} />}
            />
            <MenuRow
              label="Schedule call"
              onPress={() => undefined}
              muted
              icon={<CalendarDays size={18} color={theme.text} />}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isSearchVisible} transparent animationType="fade" onRequestClose={closeSearch}>
        <Pressable onPress={closeSearch} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.28)', justifyContent: 'flex-start', paddingHorizontal: 18, paddingTop: 88 }}>
          <Pressable
            onPress={() => undefined}
            style={{
              borderRadius: 28,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 18,
              gap: 14,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Search old chats</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages..."
              placeholderTextColor={theme.secondaryText}
              autoFocus
              style={{
                minHeight: 52,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.mutedSurface,
                paddingHorizontal: 16,
                color: theme.text,
              }}
            />
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10 }}>
              {!searchQuery.trim() ? (
                <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>Type any word to search earlier messages in this chat.</Text>
              ) : null}
              {searchQuery.trim() && filteredMessages.length === 0 ? (
                <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>No older messages matched that search.</Text>
              ) : null}
              {filteredMessages.map((message) => {
                const own = message.senderId?._id === currentUser._id;
                return (
                  <Pressable
                    key={`search-${message._id}`}
                    onPress={() => jumpToMessage(message._id)}
                    style={({ pressed }) => [
                      {
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: theme.border,
                        backgroundColor: pressed ? theme.mutedSurface : theme.surface,
                        padding: 14,
                        gap: 6,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: '700' }}>
                      {own ? 'You' : partnerLabel} - {new Date(message.createdAt).toLocaleString()}
                    </Text>
                    <Text style={{ color: theme.text, lineHeight: 20 }} numberOfLines={2}>
                      {getMessagePreview(message)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!pendingMedia} animationType="slide" onRequestClose={closePendingMedia}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={{
              paddingTop: 18,
              paddingHorizontal: 18,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.08)',
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={closePendingMedia} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: theme.text, fontSize: 28, lineHeight: 28 }}>x</Text>
              </Pressable>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{partnerLabel}</Text>
                <Text style={{ color: theme.secondaryText }}>Preview before sharing</Text>
              </View>
              <View style={{ width: 38 }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Pressable onPress={() => void pickAndSendMedia()} style={{ alignItems: 'center', gap: 6 }} disabled={isSendingPendingMedia}>
                <ImageIcon size={20} color={theme.text} />
                <Text style={{ color: theme.secondaryText, fontSize: 11 }}>Replace</Text>
              </Pressable>

              {pendingMedia?.type === 'image' ? (
                <>
                  <Pressable onPress={() => void applyImageEdit('rotate')} style={{ alignItems: 'center', gap: 6 }} disabled={isSendingPendingMedia}>
                    <RotateCcw size={20} color={theme.text} />
                    <Text style={{ color: theme.secondaryText, fontSize: 11 }}>Rotate</Text>
                  </Pressable>
                  <Pressable onPress={() => void applyImageEdit('flip')} style={{ alignItems: 'center', gap: 6 }} disabled={isSendingPendingMedia}>
                    <ArrowLeft size={20} color={theme.text} />
                    <Text style={{ color: theme.secondaryText, fontSize: 11 }}>Mirror</Text>
                  </Pressable>
                  <Pressable onPress={() => void applyImageEdit('reset')} style={{ alignItems: 'center', gap: 6 }} disabled={isSendingPendingMedia}>
                    <Pencil size={20} color={theme.text} />
                    <Text style={{ color: theme.secondaryText, fontSize: 11 }}>Reset</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 18, gap: 18 }}>
            <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
              {pendingMedia ? (
                pendingMedia.type === 'video' ? (
                  <Pressable
                    onPress={() => void openMedia(pendingMedia.uri, pendingMedia.mimeType || 'video/mp4')}
                    style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
                  >
                    <Video size={42} color={theme.green} />
                    <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 14 }}>Video ready to share</Text>
                    <Text style={{ color: theme.secondaryText, textAlign: 'center', marginTop: 8 }}>
                      Tap to preview the selected video before sending.
                    </Text>
                  </Pressable>
                ) : (
                  <Image source={{ uri: pendingMedia.uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                )
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  minHeight: 56,
                  borderRadius: 18,
                  backgroundColor: theme.surface,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                }}
              >
                <TextInput
                  value={pendingMediaCaption}
                  onChangeText={setPendingMediaCaption}
                  placeholder="Type a message"
                  placeholderTextColor={theme.secondaryText}
                  multiline
                  style={{ color: theme.text, maxHeight: 100 }}
                />
              </View>
              <Pressable
                onPress={() => void sendPendingMedia()}
                disabled={isSendingPendingMedia}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  backgroundColor: isSendingPendingMedia ? '#4A46C8' : theme.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={22} color="#0A0B2E" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FormModal visible={!!activeMediaUrl} title={activeMediaType?.startsWith('video/') ? 'Shared Video' : 'Shared Photo'} onClose={() => setActiveMediaUrl(null)}>
        <View style={{ gap: 16, paddingBottom: 12 }}>
          {activeMediaUrl && !activeMediaType?.startsWith('video/') ? (
            <Image source={{ uri: activeMediaUrl }} resizeMode="contain" style={{ width: '100%', height: 420, borderRadius: 20, backgroundColor: theme.surface }} />
          ) : null}
          {activeMediaType?.startsWith('video/') ? (
            <Text style={{ color: theme.secondaryText, lineHeight: 22 }}>This video opens in your browser so you can view it full size.</Text>
          ) : null}
          {activeMediaUrl ? <AppButton title={activeMediaType?.startsWith('video/') ? 'Open Video' : 'Open in Browser'} onPress={() => void Linking.openURL(activeMediaUrl)} /> : null}
        </View>
      </FormModal>
    </>
  );
}
