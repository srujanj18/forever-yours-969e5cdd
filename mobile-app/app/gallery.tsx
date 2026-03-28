import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { AppButton, AppShell, Card, EmptyState, FormModal, InputField, ProfileShortcut, SectionTitle, theme } from '../components/app-ui';
import { resolveAssetUrl } from '../lib/api';
import { useAppState } from '../lib/app-state';

export default function GalleryScreen() {
  const { gallery, uploadGalleryItem, deleteGalleryItem } = useAppState();
  const [visible, setVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const leftColumn = gallery.filter((_, index) => index % 2 === 0);
  const rightColumn = gallery.filter((_, index) => index % 2 === 1);

  const openMedia = async (mediaUrl?: string | null, mediaType?: string | null) => {
    const resolvedUrl = resolveAssetUrl(mediaUrl);
    if (!resolvedUrl) return;

    if (mediaType?.startsWith('video/')) {
      await Linking.openURL(resolvedUrl);
      return;
    }

    setActiveMediaUrl(resolvedUrl);
    setActiveMediaType(mediaType || 'image/jpeg');
  };

  return (
    <AppShell title="Our Gallery" subtitle="Shared snapshots and keepsakes" headerRight={<ProfileShortcut />}>
      <SectionTitle
        title="Memories"
        subtitle="A shared camera-roll feel for your favorite moments"
        right={<AppButton title="Add" onPress={() => setVisible(true)} style={{ minHeight: 42, paddingHorizontal: 16 }} leftIcon={<Plus size={16} color="#fff" />} />}
      />

      {gallery.length === 0 ? <EmptyState title="No memories yet" subtitle="Add your first photo card and start building the shared gallery." icon={<ImageIcon size={34} color={theme.secondaryText} />} /> : null}

      {gallery.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          {[leftColumn, rightColumn].map((column, columnIndex) => (
            <View key={columnIndex} style={{ flex: 1, gap: 12 }}>
              {column.map((item, itemIndex) => {
                const resolvedUrl = resolveAssetUrl(item.mediaUrl);
                const isVideo = item.mediaType?.startsWith('video/');
                const isTall = (itemIndex + columnIndex) % 3 === 0;
                const tileHeight = isVideo ? 150 : isTall ? 220 : 170;
                const isSelected = selectedItemId === item._id;

                return (
                  <Pressable
                    key={item._id}
                    onPress={() => {
                      setSelectedItemId(item._id);
                      void openMedia(item.mediaUrl, item.mediaType);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                  >
                    <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: isSelected ? theme.green : theme.border, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
                      {isVideo ? (
                        <View style={{ height: tileHeight, backgroundColor: [theme.rose, theme.pink, theme.purple, theme.green][itemIndex % 4], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Video</Text>
                          <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 6 }}>Tap to play</Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: resolvedUrl }}
                          resizeMode="cover"
                          style={{ width: '100%', height: tileHeight, backgroundColor: theme.mutedSurface }}
                        />
                      )}

                      <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 4 }}>
                        <Text numberOfLines={1} style={{ color: theme.text, fontWeight: '700' }}>
                          {item.caption || (isVideo ? 'Shared video' : 'Shared photo')}
                        </Text>
                        <Text style={{ color: theme.secondaryText, fontSize: 11 }}>
                          {format(new Date(item.createdAt), 'MMM d')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      <FormModal visible={visible} title="Add to Gallery" onClose={() => setVisible(false)}>
        <View style={{ gap: 14 }}>
          <InputField label="Caption" value={caption} onChangeText={setCaption} placeholder="A short note about this memory" multiline />
          <AppButton
            title="Pick Photo and Upload"
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });
              if (result.canceled || !result.assets[0]) return;
              await uploadGalleryItem(result.assets[0], caption);
              setCaption('');
              setVisible(false);
            }}
          />
        </View>
      </FormModal>

      <FormModal
        visible={!!activeMediaUrl}
        title={activeMediaType?.startsWith('video/') ? 'Shared Video' : 'Shared Photo'}
        onClose={() => {
          setActiveMediaUrl(null);
          setSelectedItemId(null);
        }}
      >
        <View style={{ gap: 16, paddingBottom: 12 }}>
          {activeMediaUrl && !activeMediaType?.startsWith('video/') ? (
            <Image source={{ uri: activeMediaUrl }} resizeMode="contain" style={{ width: '100%', height: 420, borderRadius: 20, backgroundColor: theme.surface }} />
          ) : null}
          {activeMediaType?.startsWith('video/') ? (
            <Text style={{ color: theme.secondaryText, lineHeight: 22 }}>This video opens in your browser so you can view it full size.</Text>
          ) : null}
          {activeMediaUrl ? <AppButton title={activeMediaType?.startsWith('video/') ? 'Open Video' : 'Open in Browser'} onPress={() => void Linking.openURL(activeMediaUrl)} /> : null}
          {selectedItemId ? <AppButton title="Remove from Gallery" variant="secondary" onPress={() => void deleteGalleryItem(selectedItemId)} /> : null}
        </View>
      </FormModal>
    </AppShell>
  );
}
