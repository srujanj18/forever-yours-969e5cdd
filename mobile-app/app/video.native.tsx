import { format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ArrowUpRight, Link2, PhoneOff, Share2, Video } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppShell, Card, EmptyState, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

const DEFAULT_GOOGLE_MEET_URL = 'https://meet.google.com/xff-cieh-kqc';

function normalizeGoogleMeetUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const meetingCode = trimmed.replace(/^https?:\/\/meet\.google\.com\//i, '').split(/[/?#]/)[0]?.trim();
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(trimmed)) {
    return `https://meet.google.com/${trimmed.toLowerCase()}`;
  }
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(meetingCode || '')) {
    return `https://meet.google.com/${meetingCode.toLowerCase()}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() !== 'meet.google.com') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function getMeetingUrlFromSignal(payload: any) {
  if (!payload || typeof payload !== 'object') return '';
  return normalizeGoogleMeetUrl(payload.meetingUrl || payload.url || '');
}

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export default function VideoScreen() {
  const {
    currentUser,
    partner,
    calls,
    activeCallType,
    incomingCall,
    callAcceptedAt,
    latestAnswerSignal,
    startCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useAppState();

  const [meetInput, setMeetInput] = useState('');
  const [meetingUrl, setMeetingUrl] = useState(DEFAULT_GOOGLE_MEET_URL);
  const [callStatus, setCallStatus] = useState('Ready to share a Google Meet link');
  const [elapsed, setElapsed] = useState(0);
  const lastAutoOpenedSessionRef = useRef('');

  const partnerName = currentUser?.customPartnerName || partner?.displayName || 'your partner';
  const incomingMeetingUrl = useMemo(() => getMeetingUrlFromSignal(incomingCall?.offer), [incomingCall?.offer]);
  const answerMeetingUrl = useMemo(() => getMeetingUrlFromSignal(latestAnswerSignal?.answer), [latestAnswerSignal?.answer]);
  const isVideoInviteActive = incomingCall?.callType === 'video' || activeCallType === 'video';
  const isIncoming = incomingCall?.callType === 'video';

  useEffect(() => {
    if (callAcceptedAt <= 0 || !isVideoInviteActive) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - callAcceptedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [callAcceptedAt, isVideoInviteActive]);

  useEffect(() => {
    if (incomingMeetingUrl) {
      setMeetingUrl(incomingMeetingUrl);
      setMeetInput(incomingMeetingUrl);
      setCallStatus(`Incoming Google Meet invite from ${incomingCall?.fromUserName || partnerName}`);
      return;
    }

    if (!isVideoInviteActive) {
      setMeetInput(DEFAULT_GOOGLE_MEET_URL);
      setMeetingUrl(DEFAULT_GOOGLE_MEET_URL);
      setCallStatus('Ready to share a Google Meet link');
      return;
    }

    if (callAcceptedAt > 0) {
      setCallStatus('Invite accepted. Open Google Meet to continue.');
      return;
    }

    setCallStatus('Invite sent. Waiting for your partner to join.');
  }, [callAcceptedAt, incomingCall?.fromUserName, incomingMeetingUrl, isVideoInviteActive, partnerName]);

  useEffect(() => {
    if (!answerMeetingUrl) return;
    setMeetingUrl(answerMeetingUrl);
    if (!meetInput.trim()) {
      setMeetInput(answerMeetingUrl);
    }
  }, [answerMeetingUrl, meetInput]);

  const openMeeting = async (urlToOpen?: string) => {
    const nextUrl = normalizeGoogleMeetUrl(urlToOpen || meetingUrl || meetInput || DEFAULT_GOOGLE_MEET_URL);
    if (!nextUrl) {
      Alert.alert('Add a Google Meet link', 'Paste a valid `meet.google.com` link or a meeting code like `abc-defg-hij` first.');
      return;
    }

    try {
      await Linking.openURL(nextUrl);
    } catch {
      Alert.alert('Unable to open Google Meet', 'Please check that the link is valid and that Google Meet is available on this device.');
    }
  };

  useEffect(() => {
    if (activeCallType !== 'video' || callAcceptedAt <= 0 || !meetingUrl) return;
    const sessionKey = `${callAcceptedAt}:${meetingUrl}`;
    if (lastAutoOpenedSessionRef.current === sessionKey) return;
    lastAutoOpenedSessionRef.current = sessionKey;
    void openMeeting(meetingUrl);
  }, [activeCallType, callAcceptedAt, meetingUrl]);

  const createInvite = () => {
    const nextUrl = normalizeGoogleMeetUrl(meetInput || DEFAULT_GOOGLE_MEET_URL);
    if (!partner?._id) {
      Alert.alert('No partner connected', 'Connect with your partner in chat before starting a video call.');
      return;
    }
    if (!nextUrl) {
      Alert.alert('Add a valid Google Meet link', 'Paste the full Meet link or a meeting code like `abc-defg-hij`.');
      return;
    }

    setMeetingUrl(nextUrl);
    setMeetInput(nextUrl);
    setCallStatus(`Sending Google Meet invite to ${partnerName}...`);
    startCall('video');
    initiateCall(partner._id, { meetingUrl: nextUrl }, 'video');
  };

  const acceptInvite = () => {
    const nextUrl = incomingMeetingUrl || meetingUrl || normalizeGoogleMeetUrl(meetInput || DEFAULT_GOOGLE_MEET_URL);
    if (!incomingCall?.fromUserId || !nextUrl) {
      Alert.alert('Invite missing', 'This video invite did not include a valid Google Meet link.');
      return;
    }

    setMeetingUrl(nextUrl);
    setMeetInput(nextUrl);
    setCallStatus('Opening Google Meet...');
    acceptCall({ meetingUrl: nextUrl });
  };

  const declineInvite = () => {
    rejectCall();
    setCallStatus('Invite declined');
  };

  const leaveInvite = () => {
    endCall();
    setCallStatus('Call ended');
  };

  const shareMeeting = async () => {
    const nextUrl = normalizeGoogleMeetUrl(meetingUrl || meetInput || DEFAULT_GOOGLE_MEET_URL);
    if (!nextUrl) {
      Alert.alert('No Google Meet link', 'Add a valid Meet link before sharing it.');
      return;
    }

    try {
      await Share.share({
        message: `Join me on Google Meet: ${nextUrl}`,
        url: nextUrl,
      });
    } catch {
      Alert.alert('Share unavailable', 'This device could not open the share sheet right now.');
    }
  };

  const openGoogleMeetHome = async () => {
    try {
      await Linking.openURL('https://meet.google.com/new');
    } catch {
      Alert.alert('Unable to open Google Meet', 'Open `https://meet.google.com/new` in your browser to generate a new meeting link.');
    }
  };

  if (!currentUser) return null;

  if (partner && isVideoInviteActive) {
    const statusText = callAcceptedAt > 0 ? timeLabel(elapsed) : callStatus;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <KeyboardAvoidingView style={styles.activeScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.hero}>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backChip, pressed && styles.pressed]}>
              <Text style={styles.backChipText}>Back</Text>
            </Pressable>
            <View style={styles.heroIcon}>
              <Video size={34} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>{incomingCall?.fromUserName || partnerName}</Text>
            <Text style={styles.heroStatus}>{statusText}</Text>
          </View>

          <Card style={styles.activeCard}>
            <Text style={styles.cardTitle}>Google Meet Link</Text>
            <Text style={styles.cardCopy}>
              Video calls now use Google Meet. Both of you will open the same Meet link once the invite is accepted.
            </Text>
            <View style={styles.linkBox}>
              <Link2 size={18} color={theme.rose} />
              <Text style={styles.linkText}>{meetingUrl || 'Waiting for a Meet link...'}</Text>
            </View>
            <View style={styles.buttonGroup}>
              <AppButton title="Open Google Meet" onPress={() => void openMeeting()} leftIcon={<ArrowUpRight size={16} color="#fff" />} />
              <AppButton title="Share Link" variant="secondary" onPress={() => void shareMeeting()} leftIcon={<Share2 size={16} color={theme.rose} />} />
            </View>
          </Card>

          {isIncoming ? (
            <View style={styles.buttonGroup}>
              <AppButton title="Accept Invite" onPress={acceptInvite} leftIcon={<Video size={16} color="#fff" />} />
              <AppButton title="Decline" variant="secondary" onPress={declineInvite} leftIcon={<PhoneOff size={16} color={theme.rose} />} />
            </View>
          ) : (
            <View style={styles.buttonGroup}>
              <AppButton title={callAcceptedAt > 0 ? 'Open Meeting Again' : 'Invite Still Ringing'} onPress={() => void openMeeting()} leftIcon={<ArrowUpRight size={16} color="#fff" />} />
              <AppButton title="End Invite" variant="secondary" onPress={leaveInvite} leftIcon={<PhoneOff size={16} color={theme.rose} />} />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <AppShell title="Google Meet" subtitle={`Meet with ${partnerName} using a shared Google Meet link`}>
      {!partner ? <EmptyState title="No partner connected" subtitle="Connect in chat first before starting a Google Meet video call." /> : null}
      {partner ? (
        <>
          <Card style={styles.setupCard}>
            <Text style={styles.setupTitle}>Start a Google Meet video call</Text>
            <Text style={styles.setupCopy}>
              Togetherly is preloaded with your shared Google Meet room. You can keep using it as-is or replace it with another Meet link anytime.
            </Text>
            <View style={styles.steps}>
              <Text style={styles.stepText}>1. The shared Meet link below is ready to use.</Text>
              <Text style={styles.stepText}>2. Tap “Send Invite” to invite {partnerName}.</Text>
              <Text style={styles.stepText}>3. You can still replace it with a different Meet link whenever you want.</Text>
            </View>
            <AppButton title="Create Meet Link" variant="secondary" onPress={() => void openGoogleMeetHome()} leftIcon={<ArrowUpRight size={16} color={theme.rose} />} />
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Google Meet link or code</Text>
              <TextInput
                value={meetInput}
                onChangeText={setMeetInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://meet.google.com/abc-defg-hij"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
              />
            </View>
            <View style={styles.buttonGroup}>
              <AppButton title="Send Invite" onPress={createInvite} leftIcon={<Video size={16} color="#fff" />} />
              <AppButton title="Open Link" variant="secondary" onPress={() => void openMeeting()} leftIcon={<ArrowUpRight size={16} color={theme.rose} />} />
            </View>
          </Card>

          <SectionTitle title="Recent Calls" />
          {calls.length === 0 ? <EmptyState title="No calls yet" subtitle="Your call history will show up here after the first invite." /> : null}
          {calls.map((call) => {
            const callPartner = call.callerId?._id === currentUser._id ? call.receiverId?.displayName : call.callerId?.displayName;
            return (
              <Card key={call._id}>
                <View style={styles.historyRow}>
                  <View style={styles.historyTextWrap}>
                    <Text style={styles.historyTitle}>{callPartner || partnerName} - {call.callType === 'voice' ? 'Voice' : 'Video'}</Text>
                    <Text style={styles.historyMeta}>{format(new Date(call.startedAt), 'MMM d, yyyy h:mm a')}</Text>
                    <Text style={styles.historyMeta}>{call.status}</Text>
                  </View>
                  <Text style={styles.historyDuration}>{call.duration ? Math.max(1, Math.round(call.duration / 60)) : 0} min</Text>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  activeScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: 'space-between',
    backgroundColor: '#07111f',
  },
  hero: {
    gap: 12,
    alignItems: 'center',
    paddingTop: 20,
  },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  heroStatus: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    textAlign: 'center',
  },
  backChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backChipText: {
    color: '#fff',
    fontWeight: '700',
  },
  activeCard: {
    backgroundColor: '#10203a',
    gap: 14,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  cardCopy: {
    color: '#dbe7f5',
    lineHeight: 20,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  linkText: {
    flex: 1,
    color: '#fff',
    lineHeight: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  setupCard: {
    backgroundColor: '#10203a',
    gap: 16,
  },
  setupTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  setupCopy: {
    color: '#dbe7f5',
    lineHeight: 20,
  },
  steps: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stepText: {
    color: '#cbd5e1',
    lineHeight: 20,
  },
  inputWrap: {
    gap: 8,
  },
  inputLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyTextWrap: {
    flex: 1,
    gap: 6,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  historyMeta: {
    color: theme.secondaryText,
    textTransform: 'capitalize',
  },
  historyDuration: {
    color: theme.rose,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
});
