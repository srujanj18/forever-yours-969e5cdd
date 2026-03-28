import React, { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Calendar, Heart, Image, MessageCircle, Phone } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { AppButton, AppShell, Card, ProfileShortcut, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

const features = [
  { title: 'Chat', description: 'Whisper sweet things, check in often, and keep your thread alive.', route: '/chat', icon: MessageCircle, color: theme.rose },
  { title: 'Gallery', description: 'Keep your favorite memories in one shared place.', route: '/gallery', icon: Image, color: theme.pink },
  { title: 'Moments', description: 'Capture the timeline of your story together.', route: '/moments', icon: Calendar, color: theme.purple },
  { title: 'Video Call', description: 'Jump into a voice or video date night whenever you want.', route: '/video', icon: Phone, color: theme.orange },
];

export default function HomeScreen() {
  const { currentUser, gallery, goals, moments, isInitializing, isSignedIn } = useAppState();
  const didNavigateRef = useRef(false);

  useEffect(() => {
    if (!isInitializing && !isSignedIn && !didNavigateRef.current) {
      didNavigateRef.current = true;
      router.replace('/auth' as never);
    }
  }, [isInitializing, isSignedIn]);

  if (!currentUser) {
    return (
      <AppShell title="Togetherly" subtitle="Loading your shared space..." showBottomNav={false}>
        <Card><Text style={{ color: theme.secondaryText }}>Loading your profile and shared data...</Text></Card>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Welcome back, ${currentUser.displayName.split(' ')[0]}`} subtitle="A thoughtful shared space for conversations, plans, and memories" headerRight={<ProfileShortcut />}>
      <Card style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Togetherly</Text>
            <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>
              Your shared home for messages, memories, plans, and quiet little rituals.
            </Text>
          </View>
          <Heart size={34} color={theme.green} fill={theme.green} />
        </View>
      </Card>

      <SectionTitle title="Explore" subtitle="The same core spaces from the web app, rebuilt for mobile" />
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <Card key={feature.title}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: feature.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} color="#fff" />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{feature.title}</Text>
                <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>{feature.description}</Text>
                <AppButton title="Open" onPress={() => router.push(feature.route as never)} />
              </View>
            </View>
          </Card>
        );
      })}

      <SectionTitle title="Quick Stats" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, backgroundColor: theme.rose }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>{gallery.length}</Text>
          <Text style={{ color: '#E6E6FF' }}>Gallery memories</Text>
        </Card>
        <Card style={{ flex: 1, backgroundColor: theme.purple }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>{moments.length}</Text>
          <Text style={{ color: '#E6E6FF' }}>Timeline entries</Text>
        </Card>
      </View>
      <Card style={{ backgroundColor: theme.green }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0A0B2E' }}>{goals.length}</Text>
        <Text style={{ color: '#0A0B2E' }}>Shared goals in motion</Text>
      </Card>
    </AppShell>
  );
}
