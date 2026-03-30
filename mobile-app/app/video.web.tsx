import { router } from 'expo-router';
import { AlertTriangle, ArrowLeft, Smartphone, Video } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { AppButton, AppShell, Card, theme } from '../components/app-ui';

export default function VideoScreenWeb() {
  return (
    <AppShell title="Call Room" subtitle="Video and voice calling is available in the mobile app build.">
      <Card style={{ backgroundColor: '#10203a', gap: 18 }}>
        <View style={{ gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Video size={30} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff' }}>Calling is not supported on web yet</Text>
          <Text style={{ color: '#dbe7f5', lineHeight: 22 }}>
            This screen uses native WebRTC modules that are available in Android and iOS builds, but not in this Expo web build.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, backgroundColor: 'rgba(15,23,42,0.5)', padding: 16 }}>
          <AlertTriangle size={20} color="#fbbf24" />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Use the native app for calls</Text>
            <Text style={{ color: '#cbd5e1', lineHeight: 20 }}>Open the Android emulator, iPhone simulator, or a device build to test calling there.</Text>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <AppButton title="Back to chat" onPress={() => router.replace('/chat')} leftIcon={<ArrowLeft size={16} color="#fff" />} />
          <AppButton title="Open home" variant="secondary" onPress={() => router.replace('/')} leftIcon={<Smartphone size={16} color={theme.rose} />} />
        </View>
      </Card>
    </AppShell>
  );
}
