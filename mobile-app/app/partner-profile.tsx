import { router } from 'expo-router';
import { Heart, Mail, MessageCircle, PencilLine } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton, AppShell, AvatarBadge, Card, FormModal, InputField, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

export default function PartnerProfileScreen() {
  const { currentUser, partner, updatePartnerNickname } = useAppState();
  const [visible, setVisible] = useState(false);
  const [nickname, setNickname] = useState(currentUser?.customPartnerName || '');

  if (!currentUser) return null;

  const displayName = useMemo(
    () => currentUser.customPartnerName || partner?.displayName || 'Partner',
    [currentUser.customPartnerName, partner]
  );

  if (!partner) {
    return (
      <AppShell title="Partner Profile" subtitle="No partner connected yet" showBottomNav={false}>
        <Card>
          <Text style={{ color: theme.secondaryText }}>Connect with your partner from the chat page first.</Text>
          <AppButton title="Go to Chat" onPress={() => router.push('/chat' as never)} />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title={`${displayName}'s Profile`} subtitle="The same partner detail page from web, adapted for mobile" showBottomNav={false}>
      <Card style={{ alignItems: 'center' }}>
        <AvatarBadge label={displayName} size={92} color={theme.pink} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{displayName}</Text>
        <Text style={{ color: theme.secondaryText }}>{partner.email || 'Email unavailable'}</Text>
        <AppButton title="Edit Custom Name" variant="secondary" onPress={() => setVisible(true)} leftIcon={<PencilLine size={16} color={theme.rose} />} />
      </Card>

      <Card>
        <SectionTitle title="Partner Details" />
        <View style={{ gap: 12 }}>
          <Row icon={<Heart size={18} color={theme.rose} />} label="Connection Status" value="Connected and in sync" />
          <Row icon={<Mail size={18} color={theme.rose} />} label="Email" value={partner.email || 'Unavailable'} />
          <Row icon={<MessageCircle size={18} color={theme.rose} />} label="Nickname You Use" value={displayName} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <AppButton title="Message" onPress={() => router.push('/chat' as never)} style={{ flex: 1 }} />
        <AppButton title="Moments" variant="secondary" onPress={() => router.push('/moments' as never)} style={{ flex: 1 }} />
      </View>

      <FormModal visible={visible} title="Custom Partner Name" onClose={() => setVisible(false)}>
        <View style={{ gap: 14 }}>
          <InputField label="Nickname" value={nickname} onChangeText={setNickname} placeholder="My favorite person" />
          <AppButton
            title="Save Nickname"
            onPress={() => {
              void updatePartnerNickname(nickname);
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
