import { format } from 'date-fns';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { router } from 'expo-router';
import { Grid3X3, Mic, MicOff, Phone, PhoneOff, Plus, Radio, UserRound, Video, VideoOff, Volume2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import { AppButton, AppShell, Card, EmptyState, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

async function applyCallAudioMode(callType: 'voice' | 'video') {
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

function CircleAction({
  icon,
  label,
  onPress,
  danger,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          gap: 8,
          width: '30%',
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? '#ef4444' : active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: danger ? '#fecaca' : 'rgba(255,255,255,0.22)',
        }}
      >
        {icon}
      </View>
      <Text style={{ color: '#eef2ff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function BottomCallButton({
  icon,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 62,
          height: 62,
          borderRadius: 31,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? '#ef4444' : 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: danger ? '#fecaca' : 'rgba(255,255,255,0.22)',
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

function CallAvatar({ callType }: { callType: 'voice' | 'video' }) {
  return (
    <View
      style={{
        width: 138,
        height: 138,
        borderRadius: 69,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.26)',
      }}
    >
      <View
        style={{
          width: 114,
          height: 114,
          borderRadius: 57,
          backgroundColor: '#e0e7ff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {callType === 'voice' ? <UserRound size={58} color="#5b6ee1" /> : <Video size={52} color="#5b6ee1" />}
      </View>
    </View>
  );
}

function StreamPanel({
  stream,
  label,
  mirror,
  placeholder,
}: {
  stream: MediaStream | null;
  label: string;
  mirror?: boolean;
  placeholder: React.ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: 'rgba(10,11,46,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
      }}
    >
      {stream ? (
        <RTCView streamURL={stream.toURL()} style={{ flex: 1 }} objectFit="cover" mirror={mirror} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>{placeholder}</View>
      )}

      <View
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          borderRadius: 999,
          backgroundColor: 'rgba(10,11,46,0.78)',
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
      >
        <Text style={{ color: '#E6E6FF', fontSize: 12, fontWeight: '700' }}>{label}</Text>
      </View>
    </View>
  );
}

export default function VideoScreen() {
  const {
    currentUser,
    partner,
    calls,
    activeCallType,
    incomingCall,
    callAcceptedAt,
    latestOfferSignal,
    latestAnswerSignal,
    latestIceCandidateSignal,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  } = useAppState();
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState('Ready to call');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const handledOfferRef = useRef<string | null>(null);
  const handledAnswerRef = useRef<string | null>(null);
  const handledIceRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);
  const handledAcceptedAtRef = useRef(0);

  const partnerName = currentUser?.customPartnerName || partner?.displayName || 'your partner';
  const incomingCallerName = incomingCall?.fromUserName || partnerName;
  const screenCallType = incomingCall?.callType || activeCallType || 'voice';
  const callPartnerId = incomingCall?.fromUserId || partner?._id || null;

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  };

  const resetCallSession = () => {
    closePeerConnection();
    stopLocalStream();
    setRemoteStream(null);
    pendingIceCandidatesRef.current = [];
    handledOfferRef.current = null;
    handledAnswerRef.current = null;
    handledIceRef.current = null;
    handledAcceptedAtRef.current = 0;
    setVideoEnabled(true);
    setAudioEnabled(true);
    setCallStatus('Ready to call');
  };

  const ensurePeerConnection = (toUserId: string) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        sendIceCandidate(toUserId, event.candidate);
      }
    });

    peerConnection.addEventListener('track', (event) => {
      const nextRemoteStream = event.streams?.[0];
      if (nextRemoteStream) {
        setRemoteStream(nextRemoteStream);
        setCallStatus(screenCallType === 'video' ? 'Video connected' : 'Voice connected');
      }
    });

    peerConnection.addEventListener('connectionstatechange', () => {
      const nextState = peerConnection.connectionState;
      if (nextState === 'connected') {
        setCallStatus(screenCallType === 'video' ? 'Video connected' : 'Voice connected');
      } else if (nextState === 'connecting') {
        setCallStatus('Connecting...');
      } else if (nextState === 'failed') {
        setCallStatus('Connection failed');
      } else if (nextState === 'disconnected') {
        setCallStatus('Disconnected');
      }
    });

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const attachLocalTracks = async (callType: 'voice' | 'video') => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video:
        callType === 'video'
          ? {
              facingMode: 'user',
              frameRate: 30,
              width: 1280,
              height: 720,
            }
          : false,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setAudioEnabled(true);
    setVideoEnabled(callType === 'video');
    return stream;
  };

  const flushPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || !pendingIceCandidatesRef.current.length) return;

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const queuedCandidate of queuedCandidates) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(queuedCandidate));
      } catch {}
    }
  };

  const createAndSendOffer = async () => {
    if (!callPartnerId || !activeCallType) return;

    try {
      setCallStatus(activeCallType === 'video' ? 'Starting video call...' : 'Starting voice call...');
      const peerConnection = ensurePeerConnection(callPartnerId);
      const stream = await attachLocalTracks(activeCallType);

      if (!peerConnection.getSenders().length) {
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });
      }

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeCallType === 'video',
      });
      await peerConnection.setLocalDescription(offer);
      sendOffer(callPartnerId, offer, activeCallType);
      setCallStatus(activeCallType === 'video' ? 'Ringing with video...' : 'Ringing with audio...');
    } catch (error: any) {
      Alert.alert('Call failed', error?.message || 'Unable to start this call right now.');
      resetCallSession();
      endCall();
    }
  };

  useEffect(() => {
    if (!incomingCall && !activeCallType) {
      resetCallSession();
    }
  }, [activeCallType, incomingCall]);

  useEffect(() => {
    if (!incomingCall && !activeCallType) {
      void resetCallAudioMode().catch(() => undefined);
      return;
    }

    void applyCallAudioMode(screenCallType).catch(() => undefined);
  }, [activeCallType, incomingCall, screenCallType]);

  useEffect(() => {
    if (!activeCallType) return;

    let cancelled = false;

    (async () => {
      try {
        await attachLocalTracks(activeCallType);
        if (!cancelled) {
          setCallStatus(activeCallType === 'video' ? 'Opening camera...' : 'Preparing microphone...');
        }
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert(
            'Permissions needed',
            error?.message || 'Camera or microphone access is required for calls.'
          );
          setCallStatus('Camera or microphone permission needed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCallType]);

  useEffect(() => {
    if (!activeCallType || !partner?._id) return;
    if (callAcceptedAt <= handledAcceptedAtRef.current) return;

    handledAcceptedAtRef.current = callAcceptedAt;
    void createAndSendOffer();
  }, [activeCallType, callAcceptedAt, partner?._id]);

  useEffect(() => {
    if (!latestOfferSignal || handledOfferRef.current === latestOfferSignal.signalId) return;
    if (latestOfferSignal.fromUserId !== callPartnerId) return;

    handledOfferRef.current = latestOfferSignal.signalId;

    (async () => {
      try {
        const nextCallType = incomingCall?.callType || activeCallType || latestOfferSignal.callType || 'video';
        const peerConnection = ensurePeerConnection(latestOfferSignal.fromUserId);
        const stream = await attachLocalTracks(nextCallType);

        if (!peerConnection.getSenders().length) {
          stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
          });
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(latestOfferSignal.offer));
        await flushPendingIceCandidates();
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendAnswer(latestOfferSignal.fromUserId, answer);
        setCallStatus(nextCallType === 'video' ? 'Joining video call...' : 'Joining voice call...');
      } catch (error: any) {
        Alert.alert('Call failed', error?.message || 'Unable to answer this call right now.');
      }
    })();
  }, [activeCallType, callPartnerId, incomingCall?.callType, latestOfferSignal]);

  useEffect(() => {
    if (!latestAnswerSignal || handledAnswerRef.current === latestAnswerSignal.signalId) return;
    if (latestAnswerSignal.fromUserId !== callPartnerId) return;
    if (!peerConnectionRef.current) return;

    handledAnswerRef.current = latestAnswerSignal.signalId;

    (async () => {
      try {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(latestAnswerSignal.answer));
        await flushPendingIceCandidates();
        setCallStatus(screenCallType === 'video' ? 'Video call connected' : 'Voice call connected');
      } catch (error: any) {
        Alert.alert('Call failed', error?.message || 'Unable to complete the connection.');
      }
    })();
  }, [callPartnerId, latestAnswerSignal, screenCallType]);

  useEffect(() => {
    if (!latestIceCandidateSignal || handledIceRef.current === latestIceCandidateSignal.signalId) return;
    if (latestIceCandidateSignal.fromUserId !== callPartnerId) return;

    handledIceRef.current = latestIceCandidateSignal.signalId;

    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingIceCandidatesRef.current.push(latestIceCandidateSignal.candidate);
      return;
    }

    void peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(latestIceCandidateSignal.candidate)).catch(() => {
      pendingIceCandidatesRef.current.push(latestIceCandidateSignal.candidate);
    });
  }, [callPartnerId, latestIceCandidateSignal]);

  useEffect(() => {
    return () => {
      resetCallSession();
      void resetCallAudioMode().catch(() => undefined);
    };
  }, []);

  const toggleAudio = () => {
    if (!localStreamRef.current) return;
    const nextValue = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setAudioEnabled(nextValue);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    const nextValue = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = nextValue;
    });
    setVideoEnabled(nextValue);
  };

  const handleAcceptCall = async () => {
    try {
      setCallStatus('Answering...');
      acceptCall();
    } catch (error: any) {
      Alert.alert('Call failed', error?.message || 'Unable to accept this call right now.');
    }
  };

  const handleRejectCall = () => {
    rejectCall();
    resetCallSession();
  };

  const handleEndCall = () => {
    endCall();
    resetCallSession();
  };

  if (!currentUser) return null;

  if (partner && (incomingCall || activeCallType)) {
    const isIncoming = !!incomingCall && !activeCallType;
    const headerLabel = isIncoming ? incomingCallerName : partnerName;

    return (
      <AppShell title={undefined} subtitle={undefined} showBottomNav={false} scroll={false}>
        <View
          style={{
            flex: 1,
            marginHorizontal: -20,
            marginBottom: -24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 34,
            backgroundColor: '#5b6ee1',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ gap: 18, flex: 1 }}>
            <View style={{ alignItems: 'center', gap: 8, marginTop: 20 }}>
              <Text style={{ color: '#f8fafc', fontSize: 30, fontWeight: '300', letterSpacing: 0.3 }}>{headerLabel}</Text>
              <Text style={{ color: '#dbeafe', fontSize: 14, letterSpacing: 1.4 }}>{callStatus}</Text>
            </View>

            {screenCallType === 'video' ? (
              <View style={{ flex: 1, gap: 14 }}>
                <StreamPanel
                  stream={remoteStream}
                  label={partnerName}
                  placeholder={
                    <View style={{ alignItems: 'center', gap: 14 }}>
                      <CallAvatar callType="video" />
                      <Text style={{ color: '#E6E6FF', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                        {isIncoming ? 'Waiting for you to accept' : 'Waiting for partner video...'}
                      </Text>
                    </View>
                  }
                />

                <View style={{ height: 166 }}>
                  <StreamPanel
                    stream={videoEnabled ? localStream : null}
                    label="You"
                    mirror
                    placeholder={
                      <View style={{ alignItems: 'center', gap: 12 }}>
                        <UserRound size={36} color="#E6E6FF" />
                        <Text style={{ color: '#E6E6FF', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
                          {videoEnabled ? 'Starting your camera...' : 'Camera off'}
                        </Text>
                      </View>
                    }
                  />
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <CallAvatar callType="voice" />
                <Text style={{ color: '#E6E6FF', fontSize: 24, fontWeight: '700' }}>{headerLabel}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14 }}>{callStatus}</Text>
              </View>
            )}
          </View>

          {incomingCall && !activeCallType ? (
            <View style={{ alignItems: 'center', gap: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '76%' }}>
                <BottomCallButton icon={<Phone size={28} color="#22c55e" />} onPress={() => void handleAcceptCall()} />
                <BottomCallButton icon={<PhoneOff size={28} color="#fff" />} onPress={handleRejectCall} danger />
              </View>
              <Pressable
                onPress={() => router.push('/chat' as never)}
                style={({ pressed }) => [
                  {
                    minWidth: 118,
                    minHeight: 30,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.28)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <Text style={{ color: '#eef2ff', fontSize: 12, fontWeight: '700' }}>Send Message</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 28 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 }}>
                <CircleAction icon={<UserRound size={22} color="#fff" />} label="Contact" />
                <CircleAction icon={<Plus size={22} color="#fff" />} label="Add Call" />
                <CircleAction
                  icon={audioEnabled ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
                  label="Mute"
                  onPress={toggleAudio}
                  active={!audioEnabled}
                />
                <CircleAction icon={<Radio size={22} color="#fff" />} label="Record" />
                {screenCallType === 'video' ? (
                  <CircleAction
                    icon={videoEnabled ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
                    label="Video"
                    onPress={toggleVideo}
                    active={!videoEnabled}
                  />
                ) : (
                  <CircleAction icon={<VideoOff size={22} color="#fff" />} label="Audio Only" active />
                )}
                <CircleAction icon={<Grid3X3 size={22} color="#fff" />} label="Keypad" />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 }}>
                <BottomCallButton icon={<Volume2 size={26} color="#fff" />} />
                <BottomCallButton icon={<PhoneOff size={28} color="#fff" />} onPress={handleEndCall} danger />
                <BottomCallButton icon={<Grid3X3 size={24} color="#fff" />} />
              </View>
            </View>
          )}
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="Call Room" subtitle={`Connect with ${partnerName}`}>
      {!partner ? <EmptyState title="No partner connected" subtitle="Connect in chat first before starting a voice or video call." /> : null}

      {partner ? (
        <>
          <Card style={{ backgroundColor: '#1f3b63' }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Real-time calling is ready</Text>
            <Text style={{ color: '#dbe7f5', lineHeight: 20 }}>
              Start a voice or video call and Togetherly will connect both devices through live WebRTC media streams.
            </Text>
            <Text style={{ color: '#cbd5e1', lineHeight: 20, fontSize: 13 }}>
              Use a rebuilt development build or APK, because Expo Go cannot run native WebRTC calling.
            </Text>
            <View style={{ gap: 12 }}>
              <AppButton title="Start Voice Call" variant="secondary" onPress={() => startCall('voice')} leftIcon={<Phone size={16} color={theme.rose} />} />
              <AppButton title="Start Video Call" onPress={() => startCall('video')} leftIcon={<Video size={16} color="#fff" />} />
            </View>
          </Card>

          <SectionTitle title="Recent Calls" />
          {calls.length === 0 ? <EmptyState title="No calls yet" subtitle="Your call history will show up here after the first one." /> : null}
          {calls.map((call) => {
            const callPartner = call.callerId?._id === currentUser._id ? call.receiverId?.displayName : call.callerId?.displayName;
            return (
              <Card key={call._id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                      {(callPartner || partnerName)} - {call.callType === 'voice' ? 'Voice' : 'Video'}
                    </Text>
                    <Text style={{ color: theme.secondaryText }}>{format(new Date(call.startedAt), 'MMM d, yyyy h:mm a')}</Text>
                  </View>
                  <Text style={{ color: theme.rose, fontWeight: '700' }}>
                    {call.duration ? Math.max(1, Math.round(call.duration / 60)) : 0} min
                  </Text>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
    </AppShell>
  );
}
