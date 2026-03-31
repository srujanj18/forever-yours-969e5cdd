import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Calendar, CircleUserRound, Home, Image, MessageCircle, Phone, Target } from 'lucide-react-native';
import { useAppState } from '../lib/app-state';

const palette = {
  background: '#0A0B2E',
  surface: '#14153D',
  mutedSurface: '#1B1D4E',
  border: '#2A2D67',
  text: '#E6E6FF',
  secondaryText: '#A8A8D0',
  rose: '#6C63FF',
  pink: '#9D4EDD',
  purple: '#9D4EDD',
  orange: '#00F5D4',
  green: '#00F5D4',
  danger: '#ff6b8a',
};

type AppShellProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  showBottomNav?: boolean;
  scroll?: boolean;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  autoBack?: boolean;
};

export function AppShell({
  title,
  subtitle,
  children,
  showBottomNav = true,
  scroll = true,
  onBack,
  headerRight,
  autoBack = true,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { latestChatNotification, dismissChatNotification, setActivePath } = useAppState();
  const shouldAutoShowBack = autoBack && pathname !== '/';
  const handleBack = onBack
    ? onBack
    : shouldAutoShowBack
      ? () => {
          const navigation = router as typeof router & { canGoBack?: () => boolean };
          if (navigation.canGoBack?.()) {
            router.back();
            return;
          }
          router.replace('/' as never);
        }
      : undefined;

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname, setActivePath]);

  useEffect(() => {
    if (!latestChatNotification || pathname === '/chat') return;
    const timeout = setTimeout(() => {
      dismissChatNotification();
    }, 3500);

    return () => clearTimeout(timeout);
  }, [dismissChatNotification, latestChatNotification, pathname]);

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.screenContent, showBottomNav ? styles.screenContentWithNav : null]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, showBottomNav ? styles.screenContentWithNav : null]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {(title || subtitle || handleBack || headerRight) && (
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            {handleBack ? <IconButton label="Back" onPress={handleBack} icon={<Text style={styles.backArrow}>{'<'}</Text>} /> : null}
          </View>
          <View style={styles.headerCenter}>
            {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerSide}>{headerRight}</View>
        </View>
      )}
      {latestChatNotification && pathname !== '/chat' ? (
        <Pressable
          onPress={() => {
            dismissChatNotification();
            router.push('/chat' as never);
          }}
          style={({ pressed }) => [styles.notificationBanner, pressed ? styles.buttonPressed : null]}
        >
          <View style={styles.notificationDot} />
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {latestChatNotification.senderName} - {latestChatNotification.unreadCount} unread
            </Text>
            <Text style={styles.notificationText} numberOfLines={2}>
              {latestChatNotification.preview}
            </Text>
          </View>
        </Pressable>
      ) : null}
      {content}
      {showBottomNav ? <BottomNav /> : null}
    </SafeAreaView>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled,
  leftIcon,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {leftIcon}
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'ghost' && styles.buttonTextGhost,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
  style,
}: {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed ? styles.buttonPressed : null, style]}>
      {icon}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.secondaryText}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.textarea : null]}
      />
    </View>
  );
}

export function AvatarBadge({ label, size = 64, color = palette.rose }: { label: string; size?: number; color?: string }) {
  const initials = label
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size / 2.7 }]}>{initials}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </Card>
  );
}

export function FormModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <IconButton label="Close" onPress={onClose} icon={<Text style={styles.closeIcon}>x</Text>} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadChatCount } = useAppState();
  const items = [
    { label: 'Home', route: '/', icon: Home },
    { label: 'Chat', route: '/chat', icon: MessageCircle },
    { label: 'Gallery', route: '/gallery', icon: Image },
    { label: 'Moments', route: '/moments', icon: Calendar },
    { label: 'Video', route: '/video', icon: Phone },
    { label: 'Goals', route: '/goals', icon: Target },
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const active = pathname === item.route;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as never)}
            style={({ pressed }) => [styles.navItem, active ? styles.navItemActive : null, pressed ? styles.buttonPressed : null]}
          >
            <View style={styles.navIconWrap}>
              <Icon size={16} color={active ? palette.surface : palette.secondaryText} />
              {item.route === '/chat' && unreadChatCount > 0 ? (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{unreadChatCount > 99 ? '99+' : unreadChatCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileShortcut() {
  const router = useRouter();
  return <IconButton label="Profile" onPress={() => router.push('/profile' as never)} icon={<CircleUserRound size={20} color={palette.rose} />} />;
}

export const theme = palette;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  screenContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  screenContentWithNav: { paddingBottom: 90 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerSide: { width: 56, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: palette.text },
  headerSubtitle: { fontSize: 13, color: palette.secondaryText, textAlign: 'center' },
  backArrow: { fontSize: 24, lineHeight: 24, color: palette.rose, fontWeight: '800' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionText: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  sectionSubtitle: { fontSize: 13, color: palette.secondaryText },
  buttonBase: { minHeight: 52, borderRadius: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonPrimary: { backgroundColor: palette.rose },
  buttonSecondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: palette.danger },
  buttonText: { color: palette.surface, fontSize: 16, fontWeight: '700' },
  buttonTextSecondary: { color: palette.rose },
  buttonTextGhost: { color: palette.secondaryText },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.45 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: palette.secondaryText },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 16, color: palette.text, fontSize: 15 },
  textarea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 14 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.surface, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: palette.text },
  emptySubtitle: { fontSize: 14, lineHeight: 20, color: palette.secondaryText, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(46, 16, 34, 0.42)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '82%', backgroundColor: palette.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  closeIcon: { fontSize: 24, lineHeight: 24, color: palette.rose, fontWeight: '800' },
  notificationBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.green },
  notificationContent: { flex: 1, gap: 2 },
  notificationTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  notificationText: { color: palette.secondaryText, fontSize: 13, lineHeight: 18 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', backgroundColor: '#14153D', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 7, gap: 3, borderWidth: 1, borderColor: '#2A2D67' },
  navItem: { width: '15%', minWidth: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 6, gap: 2 },
  navIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  chatBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.background,
  },
  chatBadgeText: { color: palette.background, fontSize: 9, fontWeight: '800' },
  navItemActive: { backgroundColor: '#6C63FF' },
  navLabel: { fontSize: 9, color: '#A8A8D0', fontWeight: '700' },
  navLabelActive: { color: palette.surface },
});
