import { format } from 'date-fns';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Grid3X3, Mic, MicOff, Minimize2, Move, Phone, PhoneOff, Plus, RefreshCcw, UserRound, Video, VideoOff, Volume2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppShell, Card, EmptyState, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

type CallType = 'voice' | 'video';
type CallScreenProps = {
  screenType?: CallType;
};

const TURN_URLS = (process.env.EXPO_PUBLIC_TURN_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ...(TURN_URLS.length && process.env.EXPO_PUBLIC_TURN_USERNAME && process.env.EXPO_PUBLIC_TURN_CREDENTIAL
    ? [{ urls: TURN_URLS, username: process.env.EXPO_PUBLIC_TURN_USERNAME, credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL }]
    : []),
];

let cachedWebRTC: any | null = null;

function getWebRTC() {
  if (!cachedWebRTC) {
    cachedWebRTC = require('react-native-webrtc');
  }
  return cachedWebRTC;
}

async function applyCallAudioMode(callType: CallType) {
  await Audio.setIsEnabledAsync(true);
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: callType === 'voice',
  });
}

async function resetCallAudioMode() {
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

function Action({ icon, label, onPress, active, danger }: { icon: React.ReactNode; label: string; onPress?: () => void; active?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={[styles.actionCircle, active && styles.actionCircleActive, danger && styles.actionCircleDanger]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function CallScreen({ screenType = 'video' }: CallScreenProps) {
  const { currentUser, partner, calls, activeCallType, incomingCall, callAcceptedAt, latestOfferSignal, latestAnswerSignal, latestIceCandidateSignal, startCall, initiateCall, acceptCall, rejectCall, endCall, sendOffer, sendAnswer, sendIceCandidate } = useAppState();
  const { width, height } = useWindowDimensions();
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [callStatus, setCallStatus] = useState('Ready to call');
  const [elapsed, setElapsed] = useState(0);
  const [previewSize, setPreviewSize] = useState({ width: 96, height: 148 });
  const [previewPosition, setPreviewPosition] = useState({ x: Math.max(12, width - 108), y: Math.max(96, height - 268) });
  const [RTCViewComponent, setRTCViewComponent] = useState<any>(() => View);
  const [webRTCBroken, setWebRTCBroken] = useState(false);

  const peerConnectionRef = useRef<any | null>(null);
  const localStreamRef = useRef<any | null>(null);
  const pendingIceRef = useRef<any[]>([]);
  const pendingAnswerRef = useRef<any | null>(null);
  const offerCreatedRef = useRef(false);
  const handledOfferRef = useRef<string | null>(null);
  const handledAnswerRef = useRef<string | null>(null);
  const handledIceRef = useRef<string | null>(null);
  const handledAcceptedAtRef = useRef(0);
  const previewStartRef = useRef(previewPosition);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTypeRef = useRef<CallType>('voice');

  const partnerName = currentUser?.customPartnerName || partner?.displayName || 'your partner';
  const headerName = incomingCall?.fromUserName || partnerName;
  const callType: CallType = incomingCall?.callType || activeCallType || 'voice';
  const callPartnerId = incomingCall?.fromUserId || partner?._id || null;
  const isIncoming = !!incomingCall && !activeCallType;
  const isVideo = screenType === 'video';

  const ensureWebRTCModule = () => {
    try {
      const module = getWebRTC();
      setRTCViewComponent(() => module.RTCView || View);
      setWebRTCBroken(false);
      return module;
    } catch (error) {
      setRTCViewComponent(() => View);
      setWebRTCBroken(true);
      throw error;
    }
  };

  const clampPreview = (x: number, y: number) => ({
    x: Math.min(Math.max(12, x), Math.max(12, width - previewSize.width - 12)),
    y: Math.min(Math.max(72, y), Math.max(72, height - previewSize.height - 128)),
  });

  useEffect(() => {
    setPreviewPosition((current) => clampPreview(current.x, current.y));
  }, [width, height, previewSize.width, previewSize.height]);

  useEffect(() => {
    if (callAcceptedAt <= 0 || (!activeCallType && !incomingCall)) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - callAcceptedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeCallType, callAcceptedAt, incomingCall]);

  const previewPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { previewStartRef.current = previewPosition; },
    onPanResponderMove: (_, g) => setPreviewPosition(clampPreview(previewStartRef.current.x + g.dx, previewStartRef.current.y + g.dy)),
  }), [previewPosition, width, height, previewSize.width, previewSize.height]);

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  const closePeer = () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
  };

  const stopLocal = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const resetCallSession = () => {
    clearRingTimeout();
    closePeer();
    stopLocal();
    setRemoteStream(null);
    setCallStatus('Ready to call');
    setAudioEnabled(true);
    setVideoEnabled(true);
    pendingIceRef.current = [];
    pendingAnswerRef.current = null;
    offerCreatedRef.current = false;
    handledOfferRef.current = null;
    handledAnswerRef.current = null;
    handledIceRef.current = null;
    handledAcceptedAtRef.current = 0;
  };

  const ensurePeer = (toUserId: string, nextCallType: CallType) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    callTypeRef.current = nextCallType;
    const { RTCPeerConnection } = ensureWebRTCModule();
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
    const eventfulPeer = peer as RTCPeerConnection & {
      addEventListener: (type: string, listener: (event: any) => void) => void;
    };
    eventfulPeer.addEventListener('icecandidate', (event) => {
      if (event.candidate) sendIceCandidate(toUserId, event.candidate);
    });
    eventfulPeer.addEventListener('track', (event) => {
      const nextRemoteStream = event.streams?.[0];
      if (nextRemoteStream) {
        setRemoteStream(nextRemoteStream);
        setCallStatus(callTypeRef.current === 'video' ? 'Video connected' : 'Voice connected');
      }
    });
    eventfulPeer.addEventListener('connectionstatechange', () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        clearRingTimeout();
        setCallStatus(callTypeRef.current === 'video' ? 'Video connected' : 'Voice connected');
      } else if (state === 'connecting') setCallStatus('Connecting securely...');
      else if (state === 'failed') setCallStatus('Connection failed');
      else if (state === 'disconnected') setCallStatus('Disconnected');
    });
    peerConnectionRef.current = peer;
    return peer;
  };

  const attachLocalTracks = async (nextCallType: CallType) => {
    const existing = localStreamRef.current;
    if (existing && (nextCallType === 'voice' || existing.getVideoTracks().length)) return existing;
    existing?.getTracks().forEach((track) => track.stop());
    const { mediaDevices } = ensureWebRTCModule();
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: nextCallType === 'video' ? { facingMode: 'user', frameRate: 24, width: 720, height: 1280 } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setAudioEnabled(true);
    setVideoEnabled(nextCallType === 'video');
    return stream;
  };

  const flushPendingIce = async () => {
    if (!peerConnectionRef.current || !pendingIceRef.current.length) return;
    const queued = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try {
        const { RTCIceCandidate } = ensureWebRTCModule();
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        pendingIceRef.current.push(candidate);
      }
    }
  };

  const applyPendingAnswerIfReady = async () => {
    if (
      !peerConnectionRef.current ||
      !pendingAnswerRef.current ||
      peerConnectionRef.current.signalingState !== 'have-local-offer'
    ) {
      return false;
    }

    const { RTCSessionDescription } = ensureWebRTCModule();
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(pendingAnswerRef.current));
    pendingAnswerRef.current = null;
    await flushPendingIce();
    setCallStatus(callTypeRef.current === 'video' ? 'Video call connected' : 'Voice call connected');
    return true;
  };

  const createAndSendOffer = async () => {
    if (!callPartnerId || !activeCallType) return;
    try {
      setCallStatus(activeCallType === 'video' ? 'Starting video call...' : 'Starting voice call...');
      const peer = ensurePeer(callPartnerId, activeCallType);
      if (offerCreatedRef.current || peer.signalingState !== 'stable' || peer.localDescription) {
        return;
      }
      const stream = await attachLocalTracks(activeCallType);
      if (!peer.getSenders().length) stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: activeCallType === 'video' });
      await peer.setLocalDescription(offer);
      offerCreatedRef.current = true;
      await applyPendingAnswerIfReady();
      initiateCall(callPartnerId, offer, activeCallType);
      setCallStatus(activeCallType === 'video' ? 'Ringing...' : 'Calling...');
    } catch (error: any) {
      Alert.alert('Call failed', error?.message || 'Unable to start this call right now.');
      resetCallSession();
      endCall();
    }
  };

  useEffect(() => {
    if (!incomingCall && !activeCallType) resetCallSession();
  }, [activeCallType, incomingCall]);

  useEffect(() => {
    if (!incomingCall && !activeCallType) {
      void resetCallAudioMode().catch(() => undefined);
      return;
    }
    void applyCallAudioMode(callType).catch(() => undefined);
  }, [activeCallType, incomingCall, callType]);

  useEffect(() => {
    if (webRTCBroken) {
      setCallStatus('Update the Android dev build to use calling');
    }
  }, [webRTCBroken]);

  useEffect(() => {
    if (!activeCallType) return;
    let cancelled = false;
    (async () => {
      try {
        await attachLocalTracks(activeCallType);
        if (!cancelled) setCallStatus(activeCallType === 'video' ? 'Preparing camera...' : 'Preparing microphone...');
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert('Permissions needed', error?.message || 'Camera or microphone access is required for calls.');
          setCallStatus('Camera or microphone permission needed');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeCallType]);

  useEffect(() => {
    clearRingTimeout();
    if (!activeCallType || incomingCall || callAcceptedAt > 0) return;
    ringTimeoutRef.current = setTimeout(() => {
      setCallStatus('No answer');
      endCall();
      resetCallSession();
      Alert.alert('No answer', `${partnerName} did not answer this call.`);
    }, 45000);
    return clearRingTimeout;
  }, [activeCallType, incomingCall, callAcceptedAt, partnerName]);

  useEffect(() => {
    if (!activeCallType || !partner?._id || incomingCall) return;
    void createAndSendOffer();
  }, [activeCallType, incomingCall, partner?._id]);

  useEffect(() => {
    if (callAcceptedAt <= 0 || callAcceptedAt <= handledAcceptedAtRef.current) return;
    handledAcceptedAtRef.current = callAcceptedAt;
    clearRingTimeout();
  }, [callAcceptedAt]);

  useEffect(() => {
    if (!latestOfferSignal || handledOfferRef.current === latestOfferSignal.signalId || latestOfferSignal.fromUserId !== callPartnerId) return;
    handledOfferRef.current = latestOfferSignal.signalId;
    (async () => {
      try {
        const nextCallType = incomingCall?.callType || activeCallType || latestOfferSignal.callType || 'video';
        const peer = ensurePeer(latestOfferSignal.fromUserId, nextCallType);
        if (
          peer.remoteDescription?.type === 'offer' &&
          peer.remoteDescription?.sdp === latestOfferSignal.offer?.sdp
        ) {
          return;
        }
        if (peer.signalingState !== 'stable' && peer.signalingState !== 'have-remote-offer') {
          return;
        }
        const stream = await attachLocalTracks(nextCallType);
        if (!peer.getSenders().length) stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const { RTCSessionDescription } = ensureWebRTCModule();
        await peer.setRemoteDescription(new RTCSessionDescription(latestOfferSignal.offer));
        await flushPendingIce();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendAnswer(latestOfferSignal.fromUserId, answer);
        setCallStatus(nextCallType === 'video' ? 'Joining video call...' : 'Joining voice call...');
      } catch (error: any) {
        Alert.alert('Call failed', error?.message || 'Unable to answer this call right now.');
      }
    })();
  }, [activeCallType, callPartnerId, incomingCall?.callType, latestOfferSignal, sendAnswer]);

  useEffect(() => {
    if (!latestAnswerSignal || handledAnswerRef.current === latestAnswerSignal.signalId || latestAnswerSignal.fromUserId !== callPartnerId || !peerConnectionRef.current) return;
    (async () => {
      try {
        const peer = peerConnectionRef.current;
        if (!peer) return;

        if (
          peer.remoteDescription?.type === 'answer' &&
          peer.remoteDescription?.sdp === latestAnswerSignal.answer?.sdp
        ) {
          handledAnswerRef.current = latestAnswerSignal.signalId;
          return;
        }

        if (
          peer.signalingState === 'stable' ||
          !peer.localDescription ||
          peer.localDescription.type !== 'offer'
        ) {
          handledAnswerRef.current = latestAnswerSignal.signalId;
          return;
        }

        if (peer.signalingState !== 'have-local-offer') {
          pendingAnswerRef.current = latestAnswerSignal.answer;
          return;
        }

        const { RTCSessionDescription } = ensureWebRTCModule();
        await peer.setRemoteDescription(new RTCSessionDescription(latestAnswerSignal.answer));
        pendingAnswerRef.current = null;
        handledAnswerRef.current = latestAnswerSignal.signalId;
        await flushPendingIce();
        setCallStatus(callTypeRef.current === 'video' ? 'Video call connected' : 'Voice call connected');
      } catch (error: any) {
        const errorMessage = String(error?.message || '');
        if (errorMessage.includes('Failed to set remote answer sdp') || errorMessage.includes('Called in wrong state: stable')) {
          handledAnswerRef.current = latestAnswerSignal.signalId;
          pendingAnswerRef.current = null;
          return;
        }
        Alert.alert('Call failed', error?.message || 'Unable to complete the connection.');
      }
    })();
  }, [callPartnerId, latestAnswerSignal]);

  useEffect(() => {
    if (!latestIceCandidateSignal || handledIceRef.current === latestIceCandidateSignal.signalId || latestIceCandidateSignal.fromUserId !== callPartnerId) return;
    handledIceRef.current = latestIceCandidateSignal.signalId;
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingIceRef.current.push(latestIceCandidateSignal.candidate);
      return;
    }
    void (() => {
      const { RTCIceCandidate } = ensureWebRTCModule();
      return peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(latestIceCandidateSignal.candidate));
    })().catch(() => pendingIceRef.current.push(latestIceCandidateSignal.candidate));
  }, [callPartnerId, latestIceCandidateSignal]);

  useEffect(() => () => {
    resetCallSession();
    void resetCallAudioMode().catch(() => undefined);
  }, []);

  const toggleAudio = () => {
    if (!localStreamRef.current) return;
    const next = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = next; });
    setAudioEnabled(next);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const next = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((track) => { track.enabled = next; });
    setVideoEnabled(next);
  };

  const switchCamera = () => {
    const [track] = localStreamRef.current?.getVideoTracks() || [];
    (track as any)?._switchCamera?.();
  };

  const resizePreview = (delta: number) => setPreviewSize((current) => {
    const nextWidth = Math.min(Math.max(84, current.width + delta), 148);
    return { width: nextWidth, height: Math.round(nextWidth * 1.54) };
  });

  const acceptIncoming = async () => {
    try {
      setCallStatus('Answering...');
      if (!incomingCall?.fromUserId || !incomingCall.offer) {
        throw new Error('Missing incoming call offer');
      }

      const peer = ensurePeer(incomingCall.fromUserId, callType);
      const stream = await attachLocalTracks(callType);
      if (!peer.getSenders().length) {
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      }
      const { RTCSessionDescription } = ensureWebRTCModule();
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      await flushPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      acceptCall(answer);
      setCallStatus(callType === 'video' ? 'Joining video call...' : 'Joining voice call...');
    } catch (error: any) {
      Alert.alert('Call failed', error?.message || 'Unable to accept this call right now.');
    }
  };

  const leaveCall = () => {
    endCall();
    resetCallSession();
  };

  if (!currentUser) return null;
  if (partner && (incomingCall || activeCallType)) {
    const statusText = callAcceptedAt ? timeLabel(elapsed) : callStatus;
    if (isVideo) {
      return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <StatusBar style="light" />
          <View style={styles.stage}>
            {remoteStream ? <RTCViewComponent streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFillObject} objectFit="cover" /> : <View style={styles.remoteFallback}><View style={styles.remoteFallbackBadge}><UserRound size={78} color="#c7d2fe" /></View><Text style={styles.name}>{headerName}</Text><Text style={styles.status}>{statusText}</Text></View>}
            <View style={styles.overlay} />
            <View style={styles.topBar}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backChip, pressed && styles.pressed]}><Minimize2 size={16} color="#fff" /><Text style={styles.backChipText}>Back</Text></Pressable>
              <View style={styles.topText}><Text style={styles.topName}>{headerName}</Text><Text style={styles.topStatus}>{statusText}</Text></View>
            </View>
            <View {...previewPanResponder.panHandlers} style={[styles.preview, { width: previewSize.width, height: previewSize.height, left: previewPosition.x, top: previewPosition.y }]}>
              {videoEnabled && localStream ? <RTCViewComponent streamURL={localStream.toURL()} style={StyleSheet.absoluteFillObject} objectFit="cover" mirror /> : <View style={styles.previewFallback}><UserRound size={30} color="#fff" /><Text style={styles.previewText}>{videoEnabled ? 'Starting camera...' : 'Camera off'}</Text></View>}
              <View style={styles.previewBar}>
                <View style={styles.previewIdentity}>
                  <Move size={13} color="#fff" />
                  <Text style={styles.previewLabel}>You</Text>
                </View>
                <View style={styles.previewActions}>
                  <Pressable onPress={() => resizePreview(-20)} style={({ pressed }) => [styles.previewBtn, pressed && styles.pressed]}><Minimize2 size={12} color="#fff" /></Pressable>
                  <Pressable onPress={() => resizePreview(20)} style={({ pressed }) => [styles.previewBtn, pressed && styles.pressed]}><Plus size={12} color="#fff" /></Pressable>
                </View>
              </View>
            </View>
            {isIncoming ? <View style={styles.bottomRow}><Action icon={<Phone size={24} color="#22c55e" />} label="Accept" onPress={() => void acceptIncoming()} /><Action icon={<PhoneOff size={24} color="#fff" />} label="Decline" onPress={() => { rejectCall(); resetCallSession(); }} danger /></View> : <View style={styles.bottomTray}><Action icon={audioEnabled ? <Mic size={20} color="#fff" /> : <MicOff size={20} color="#fff" />} label={audioEnabled ? 'Mute' : 'Unmute'} onPress={toggleAudio} active={!audioEnabled} /><Action icon={videoEnabled ? <Video size={20} color="#fff" /> : <VideoOff size={20} color="#fff" />} label={videoEnabled ? 'Video' : 'Video Off'} onPress={toggleVideo} active={!videoEnabled} /><Action icon={<RefreshCcw size={20} color="#fff" />} label="Switch" onPress={switchCamera} /><Action icon={<PhoneOff size={20} color="#fff" />} label="End" onPress={leaveCall} danger /></View>}
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.voiceStage}>
          <View style={styles.voiceGlowOne} />
          <View style={styles.voiceGlowTwo} />
          <View style={styles.voiceHeader}><Text style={styles.voiceName}>{headerName}</Text><Text style={styles.voiceStatus}>{statusText}</Text></View>
          <View style={styles.voiceAvatar}><UserRound size={96} color="#dbeafe" /></View>
          {isIncoming ? <View style={styles.bottomRow}><Action icon={<Phone size={24} color="#22c55e" />} label="Accept" onPress={() => void acceptIncoming()} /><Action icon={<PhoneOff size={24} color="#fff" />} label="Decline" onPress={() => { rejectCall(); resetCallSession(); }} danger /></View> : <View style={styles.voiceControls}><View style={styles.voiceRow}><Action icon={audioEnabled ? <Mic size={20} color="#fff" /> : <MicOff size={20} color="#fff" />} label={audioEnabled ? 'Mute' : 'Unmute'} onPress={toggleAudio} active={!audioEnabled} /><Action icon={<Volume2 size={20} color="#fff" />} label="Speaker" /><Action icon={<Grid3X3 size={20} color="#fff" />} label="Keypad" /></View><Pressable onPress={leaveCall} style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}><PhoneOff size={28} color="#fff" /></Pressable></View>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AppShell title="Call Room" subtitle={`Connect with ${partnerName}`}>
      {!partner ? <EmptyState title="No partner connected" subtitle="Connect in chat first before starting a voice or video call." /> : null}
      {partner ? <>
        <Card style={{ backgroundColor: '#1f3b63' }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Real-time calling</Text>
          <Text style={{ color: '#dbe7f5', lineHeight: 20 }}>Voice and video calls work app-to-app through WebRTC media streams.</Text>
          <Text style={{ color: '#cbd5e1', lineHeight: 20, fontSize: 13 }}>For global reliability, configure TURN credentials in `mobile-app/.env`. Calling actual phone numbers needs a telephony provider and is not implemented in this repo.</Text>
          {webRTCBroken ? <Text style={{ color: '#fcd34d', lineHeight: 20, fontSize: 13 }}>This installed Android dev client is not compatible with the current WebRTC native module. Rebuild and reinstall the development APK, then relaunch the app.</Text> : null}
          <View style={{ gap: 12 }}>
            <AppButton title="Start Voice Call" variant="secondary" onPress={() => startCall('voice')} leftIcon={<Phone size={16} color={theme.rose} />} />
            <AppButton title="Start Video Call" onPress={() => startCall('video')} leftIcon={<Video size={16} color="#fff" />} />
          </View>
        </Card>
        <SectionTitle title="Recent Calls" />
        {calls.length === 0 ? <EmptyState title="No calls yet" subtitle="Your call history will show up here after the first one." /> : null}
        {calls.map((call) => {
          const callPartner = call.callerId?._id === currentUser._id ? call.receiverId?.displayName : call.callerId?.displayName;
          return <Card key={call._id}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, gap: 6 }}><Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{(callPartner || partnerName)} - {call.callType === 'voice' ? 'Voice' : 'Video'}</Text><Text style={{ color: theme.secondaryText }}>{format(new Date(call.startedAt), 'MMM d, yyyy h:mm a')}</Text><Text style={{ color: theme.secondaryText, textTransform: 'capitalize' }}>{call.status}</Text></View><Text style={{ color: theme.rose, fontWeight: '700' }}>{call.duration ? Math.max(1, Math.round(call.duration / 60)) : 0} min</Text></View></Card>;
        })}
      </> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' }, stage: { flex: 1, backgroundColor: '#050816' }, overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,18,0.16)' },
  remoteFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#0b1023', paddingHorizontal: 28 }, remoteFallbackBadge: { width: 144, height: 144, borderRadius: 72, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, name: { color: '#fff', fontSize: 32, fontWeight: '700' }, status: { color: 'rgba(255,255,255,0.78)', fontSize: 15, textAlign: 'center' },
  topBar: { position: 'absolute', top: 14, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, topText: { alignItems: 'flex-end', gap: 4, maxWidth: '68%' }, topName: { color: '#fff', fontSize: 22, fontWeight: '700' }, topStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'right' },
  backChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.34)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 }, backChipText: { color: '#fff', fontWeight: '700' },
  preview: { position: 'absolute', borderRadius: 20, overflow: 'hidden', backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 }, previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, previewText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  previewBar: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: 'rgba(0,0,0,0.46)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 }, previewIdentity: { flexDirection: 'row', alignItems: 'center', gap: 6 }, previewActions: { flexDirection: 'row', alignItems: 'center', gap: 6 }, previewLabel: { color: '#fff', fontSize: 11, fontWeight: '700' }, previewBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  bottomRow: { position: 'absolute', left: 0, right: 0, bottom: 36, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }, bottomTray: { position: 'absolute', left: 14, right: 14, bottom: 28, flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: 'rgba(3,7,18,0.38)', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 8 },
  action: { width: 82, alignItems: 'center', gap: 8 }, actionCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }, actionCircleActive: { backgroundColor: 'rgba(108,99,255,0.92)' }, actionCircleDanger: { backgroundColor: '#ef4444' }, actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  voiceStage: { flex: 1, backgroundColor: '#081120', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 36 }, voiceGlowOne: { position: 'absolute', top: 70, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(108,99,255,0.24)' }, voiceGlowTwo: { position: 'absolute', bottom: 180, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(0,245,212,0.14)' }, voiceHeader: { alignItems: 'center', gap: 8, marginTop: 28 }, voiceName: { color: '#fff', fontSize: 32, fontWeight: '700' }, voiceStatus: { color: 'rgba(255,255,255,0.76)', fontSize: 15 }, voiceAvatar: { width: 188, height: 188, borderRadius: 94, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }, voiceControls: { width: '100%', gap: 30, alignItems: 'center' }, voiceRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-evenly' }, endButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444' }, pressed: { opacity: 0.86 },
});

export default function VideoScreen() {
  return <CallScreen screenType="video" />;
}
