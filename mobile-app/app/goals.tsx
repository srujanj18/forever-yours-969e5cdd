import { format } from 'date-fns';
import { Check, Plus, Target } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppButton, AppShell, Card, EmptyState, FormModal, InputField, ProfileShortcut, SectionTitle, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';

export default function GoalsScreen() {
  const { goals, addGoal, toggleGoal, deleteGoal } = useAppState();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('2026-05-01');

  return (
    <AppShell title="Our Goals" subtitle="Shared plans and promises" headerRight={<ProfileShortcut />}>
      <SectionTitle
        title="Dream List"
        subtitle="A mobile take on the web goals board"
        right={<AppButton title="Add" onPress={() => setVisible(true)} style={{ minHeight: 42, paddingHorizontal: 16 }} leftIcon={<Plus size={16} color="#fff" />} />}
      />

      {goals.length === 0 ? <EmptyState title="No goals yet" subtitle="Start a list of places, rituals, and adventures to build together." icon={<Target size={34} color={theme.secondaryText} />} /> : null}

      {goals.map((goal) => (
        <Card key={goal._id} style={{ backgroundColor: goal.isCompleted ? '#1B1D4E' : theme.surface }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => void toggleGoal(goal._id, !goal.isCompleted)}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: goal.isCompleted ? theme.green : theme.mutedSurface, alignItems: 'center', justifyContent: 'center' }}>
                {goal.isCompleted ? <Check size={18} color="#0A0B2E" /> : null}
              </View>
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, textDecorationLine: goal.isCompleted ? 'line-through' : 'none' }}>
                {goal.title}
              </Text>
              <Text style={{ color: theme.secondaryText }}>{goal.description}</Text>
              <Text style={{ color: theme.secondaryText, fontSize: 12 }}>Target: {format(new Date(goal.targetDate), 'MMMM d, yyyy')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <AppButton title={goal.isCompleted ? 'Mark Incomplete' : 'Mark Complete'} variant="secondary" onPress={() => void toggleGoal(goal._id, !goal.isCompleted)} style={{ flex: 1 }} />
            <AppButton title="Delete" variant="ghost" onPress={() => void deleteGoal(goal._id)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      <FormModal visible={visible} title="Create a Goal" onClose={() => setVisible(false)}>
        <View style={{ gap: 14 }}>
          <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Plan a weekend trip" />
          <InputField label="Description" value={description} onChangeText={setDescription} placeholder="Add a note" multiline />
          <InputField label="Target Date" value={targetDate} onChangeText={setTargetDate} placeholder="2026-05-01" />
          <AppButton
            title="Save Goal"
            onPress={() => {
              void addGoal(title || 'New Goal', description || 'A fresh shared plan.', targetDate);
              setTitle('');
              setDescription('');
              setTargetDate('2026-05-01');
              setVisible(false);
            }}
          />
        </View>
      </FormModal>
    </AppShell>
  );
}
