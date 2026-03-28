import { format } from 'date-fns';
import { router } from 'expo-router';
import {
  Grid3X3,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneOff,
  Plus,
  Radio,
  UserRound,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppButton, AppShell, Card, EmptyState, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

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

export default function VideoScreen() {
  const { currentUser, partner, calls, activeCallType, incomingCall, startCall, acceptCall, rejectCall, endCall } = useAppState();
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  if (!currentUser) return null;

  const partnerName = currentUser.customPartnerName || partner?.displayName || 'your partner';
  const incomingCallerName = incomingCall?.fromUserName || partnerName;
  const screenCallType = incomingCall?.callType || activeCallType || 'voice';

  const resetLocalToggles = () => {
    setVideoEnabled(true);
    setAudioEnabled(true);
  };

  if (partner && (incomingCall || activeCallType)) {
    const isIncoming = !!incomingCall && !activeCallType;
    const headerLabel = isIncoming ? incomingCallerName : partnerName;
    const statusLabel = isIncoming
      ? screenCallType === 'voice'
        ? 'CALLING...'
        : 'VIDEO CALLING...'
      : screenCallType === 'voice'
        ? 'CALLING...'
        : 'IN CALL...';

    return (
      <AppShell title={undefined} subtitle={undefined} showBottomNav={false} scroll={false}>
        <View
          style={{
            flex: 1,
            marginHorizontal: -20,
            marginBottom: -24,
            paddingHorizontal: 28,
            paddingTop: 28,
            paddingBottom: 34,
            backgroundColor: '#5b6ee1',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ alignItems: 'center', gap: 18, marginTop: 28 }}>
            <Text style={{ color: '#f8fafc', fontSize: 34, fontWeight: '300', letterSpacing: 0.3 }}>{headerLabel}</Text>
            <CallAvatar callType={screenCallType} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#dbeafe', fontSize: 16, letterSpacing: 1.8 }}>{statusLabel}</Text>
              {screenCallType === 'video' && !isIncoming ? (
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>Camera {videoEnabled ? 'enabled' : 'disabled'}</Text>
              ) : null}
            </View>
          </View>

          {isIncoming ? (
            <View style={{ alignItems: 'center', gap: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '76%' }}>
                <BottomCallButton icon={<Phone size={28} color="#22c55e" />} onPress={acceptCall} />
                <BottomCallButton
                  icon={<PhoneOff size={28} color="#fff" />}
                  onPress={() => {
                    rejectCall();
                    resetLocalToggles();
                  }}
                  danger
                />
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
                <CircleAction icon={audioEnabled ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />} label="Mute" onPress={() => setAudioEnabled((value) => !value)} active={!audioEnabled} />
                <CircleAction icon={<Pause size={22} color="#fff" />} label="Hold" />
                {screenCallType === 'video' ? (
                  <CircleAction
                    icon={videoEnabled ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
                    label="Video"
                    onPress={() => setVideoEnabled((value) => !value)}
                    active={!videoEnabled}
                  />
                ) : (
                  <CircleAction icon={<Video size={22} color="#fff" />} label="Video Call" />
                )}
                <CircleAction icon={<Radio size={22} color="#fff" />} label="Record" />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 }}>
                <BottomCallButton icon={<Volume2 size={26} color="#fff" />} />
                <BottomCallButton
                  icon={<PhoneOff size={28} color="#fff" />}
                  onPress={() => {
                    endCall();
                    resetLocalToggles();
                  }}
                  danger
                />
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
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Ready for a date call?</Text>
            <Text style={{ color: '#dbe7f5', lineHeight: 20 }}>
              Start a voice or video call and the full-screen call view will open automatically.
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
