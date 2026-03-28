import { format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton, AppShell, Card, EmptyState, FormModal, InputField, ProfileShortcut, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

export default function MomentsScreen() {
  const { moments, addMoment, deleteMoment, currentUser } = useAppState();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-03-27');

  const formatMomentDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'MMMM d, yyyy');
  };

  return (
    <AppShell title="Our Moments" subtitle="The relationship timeline from the web app" headerRight={<ProfileShortcut />}>
      <SectionTitle
        title="Timeline"
        subtitle="Major milestones, quiet milestones, and all the in-between"
        right={<AppButton title="Add" onPress={() => setVisible(true)} style={{ minHeight: 42, paddingHorizontal: 16 }} leftIcon={<Plus size={16} color="#fff" />} />}
      />

      {moments.length === 0 ? <EmptyState title="No moments yet" subtitle="Add your first chapter to the timeline." /> : null}

      {moments.map((moment, index) => (
        <View key={moment._id} style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, marginTop: 22, backgroundColor: [theme.rose, theme.orange, theme.purple, theme.green][index % 4] }} />
            <View style={{ width: 2, flex: 1, backgroundColor: theme.border }} />
          </View>
          <Card style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: theme.secondaryText }}>{formatMomentDate(moment.date)}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{moment.title}</Text>
            {moment.description ? <Text style={{ color: theme.secondaryText, lineHeight: 20 }}>{moment.description}</Text> : null}
            {currentUser && moment.senderId === currentUser._id ? (
              <AppButton title="Delete Moment" variant="secondary" onPress={() => void deleteMoment(moment._id)} />
            ) : null}
          </Card>
        </View>
      ))}

      <FormModal visible={visible} title="Create a Moment" onClose={() => setVisible(false)}>
        <View style={{ gap: 14 }}>
          <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Promise night" />
          <InputField label="Description" value={description} onChangeText={setDescription} placeholder="What made this one matter?" multiline />
          <InputField label="Date" value={date} onChangeText={setDate} placeholder="2026-03-27" />
          <AppButton
            title="Add to Timeline"
            onPress={() => {
              void addMoment(title || 'New Moment', description || 'A fresh chapter in your timeline.', date);
              setTitle('');
              setDescription('');
              setDate('2026-03-27');
              setVisible(false);
            }}
          />
        </View>
      </FormModal>
    </AppShell>
  );
}
