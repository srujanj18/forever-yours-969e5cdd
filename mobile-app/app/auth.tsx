import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { AppButton, AppShell, Card, InputField, theme } from '../components/app-ui';
import { useAppState } from '../lib/app-state';
import { useState } from 'react';

export default function AuthScreen() {
  const { authMode, setAuthMode, signIn, signUp, isLoading, error } = useAppState();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');

  const submit = async () => {
    if (authMode === 'login') await signIn(email, password);
    else await signUp(name || 'Avery Rose', email, password);
    router.replace('/' as never);
  };

  return (
    <AppShell showBottomNav={false} title="Togetherly" subtitle="Sign in or create your shared space">
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.rose, alignItems: 'center', justifyContent: 'center' }}>
          <Heart size={34} color="#fff" fill="#fff" />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>Togetherly</Text>
        <Text style={{ color: theme.secondaryText, textAlign: 'center', lineHeight: 20 }}>
          {authMode === 'login'
            ? 'Welcome back. Your dashboard, conversations, and memories are ready.'
            : 'Create your account and start building your shared story.'}
        </Text>
      </Card>

      <Card>
        {authMode === 'signup' ? (
          <>
            <InputField label="Your Name" value={name} onChangeText={setName} placeholder="Avery Rose" />
            <InputField label="Date of Birth" value={birthday} onChangeText={setBirthday} placeholder="1998-04-22" />
          </>
        ) : null}
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        <AppButton title={isLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'} onPress={() => void submit()} disabled={isLoading} />
        <AppButton
          title={authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          variant="ghost"
          disabled={isLoading}
          onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
        />
      </Card>
    </AppShell>
  );
}
