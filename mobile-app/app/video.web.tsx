import { router } from 'expo-router';
import { ArrowLeft, ArrowUpRight, Smartphone, Video } from 'lucide-react-native';
import { Linking, Text, View } from 'react-native';
import { AppButton, AppShell, Card, theme } from '../components/app-ui';

export default function VideoScreenWeb() {
  return (
    <AppShell title="Google Meet" subtitle="Video calls now use a shared Google Meet link.">
      <Card style={{ backgroundColor: '#10203a', gap: 18 }}>
        <View style={{ gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Video size={30} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Google Meet works from here too</Text>
          <Text style={{ color: '#dbe7f5', lineHeight: 22 }}>
            Create a Google Meet link, share it with your partner, and open the meeting in your browser.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, backgroundColor: 'rgba(15,23,42,0.5)', padding: 16 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Use Meet to generate the link</Text>
            <Text style={{ color: '#cbd5e1', lineHeight: 20 }}>Open Google Meet, create a meeting, then share that link through the mobile app's video call screen.</Text>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <AppButton title="Open Google Meet" onPress={() => void Linking.openURL('https://meet.google.com/new')} leftIcon={<ArrowUpRight size={16} color="#fff" />} />
          <AppButton title="Back to chat" onPress={() => router.replace('/chat')} leftIcon={<ArrowLeft size={16} color="#fff" />} />
          <AppButton title="Open home" variant="secondary" onPress={() => router.replace('/')} leftIcon={<Smartphone size={16} color={theme.rose} />} />
        </View>
      </Card>
    </AppShell>
  );
}
