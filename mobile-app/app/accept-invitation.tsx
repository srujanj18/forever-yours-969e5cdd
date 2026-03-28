import { useLocalSearchParams, router } from 'expo-router';
import { AlertTriangle, CheckCircle2, Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton, AppShell, Card, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { acceptInvitation, partner, isSignedIn } = useAppState();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    void acceptInvitation(token).then(setSuccess).catch(() => setSuccess(false));
  }, [acceptInvitation, isSignedIn, token]);

  return (
    <AppShell title="Invitation" subtitle="Accept your partner invite" showBottomNav={false}>
      <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
        {success ? <CheckCircle2 size={54} color={theme.green} /> : <AlertTriangle size={54} color={theme.danger} />}
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{success ? 'Invitation Accepted' : 'Invitation Invalid'}</Text>
        <Text style={{ color: theme.secondaryText, textAlign: 'center', lineHeight: 20 }}>
          {success
            ? `You are now connected with ${partner?.displayName || 'your partner'}.`
            : 'We could not verify that invitation token. Try opening the link again after signing in.'}
        </Text>
        <AppButton title={success ? 'Go to Chat' : 'Go to Login'} onPress={() => router.replace((success ? '/chat' : '/auth') as never)} />
      </Card>

      <Card style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Heart size={22} color={theme.green} fill={theme.green} />
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Togetherly</Text>
        </View>
        <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>
          This page now accepts real invitation tokens against your backend.
        </Text>
      </Card>
    </AppShell>
  );
}
