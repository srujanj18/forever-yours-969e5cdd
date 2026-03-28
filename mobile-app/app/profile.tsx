import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Heart, LogOut, Mail, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton, AppShell, AvatarBadge, Card, FormModal, InputField, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

export default function ProfileScreen() {
  const { currentUser, partner, updateCurrentUserName, signOut, uploadAvatar } = useAppState();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(currentUser?.displayName || '');

  if (!currentUser) return null;

  return (
    <AppShell title="My Profile" subtitle="Your account, connection, and quick links" showBottomNav={false}>
      <Card style={{ alignItems: 'center' }}>
        <AvatarBadge label={currentUser.displayName} size={88} color={theme.rose} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{currentUser.displayName}</Text>
        <Text style={{ color: theme.secondaryText }}>{currentUser.email}</Text>
        <AppButton title="Edit Name" variant="secondary" onPress={() => setVisible(true)} />
        <AppButton
          title="Upload Avatar"
          variant="ghost"
          onPress={async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (result.canceled || !result.assets[0]) return;
            await uploadAvatar(result.assets[0]);
          }}
        />
      </Card>

      <Card>
        <SectionTitle title="Account" />
        <View style={{ gap: 12 }}>
          <Row icon={<User size={18} color={theme.rose} />} label="Display Name" value={currentUser.displayName} />
          <Row icon={<Mail size={18} color={theme.rose} />} label="Email" value={currentUser.email} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Partner" subtitle={partner ? 'You are connected' : 'No partner linked yet'} />
        {partner ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <AvatarBadge label={currentUser.customPartnerName || partner.displayName} size={62} color={theme.pink} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                  {currentUser.customPartnerName || partner.displayName}
                </Text>
                <Text style={{ color: theme.secondaryText }}>{partner.email || 'Email unavailable in profile response'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AppButton title="Partner Profile" onPress={() => router.push('/partner-profile' as never)} style={{ flex: 1 }} />
              <AppButton title="Chat" variant="secondary" onPress={() => router.push('/chat' as never)} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <Text style={{ color: theme.secondaryText }}>Head to chat to invite your partner.</Text>
        )}
      </Card>

      <Card style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
        <Heart size={24} color={theme.green} fill={theme.green} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Built for your story</Text>
        <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>
          This mobile version now reads and updates your real backend profile.
        </Text>
      </Card>

      <AppButton
        title="Sign Out"
        variant="danger"
        onPress={() => {
          void signOut();
          router.replace('/auth' as never);
        }}
        leftIcon={<LogOut size={16} color="#fff" />}
      />

      <FormModal visible={visible} title="Edit Profile" onClose={() => setVisible(false)}>
        <View style={{ gap: 14 }}>
          <InputField label="Display Name" value={name} onChangeText={setName} placeholder="Avery Rose" />
          <AppButton
            title="Save"
            onPress={() => {
              void updateCurrentUserName(name);
              setVisible(false);
            }}
          />
        </View>
      </FormModal>
    </AppShell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.secondaryText, fontSize: 12, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{value}</Text>
      </View>
    </View>
  );
}
