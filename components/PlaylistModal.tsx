import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable,
  FlatList, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Theme } from '@/constants/Theme';
import { Plus, ListMusic, ChevronRight, X } from 'lucide-react-native';
import Animated, { FadeInUp, SlideInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (playlistId: string) => void;
  onCreateNew: (name: string) => void;
}

export default function PlaylistModal({ visible, onClose, onSelect, onCreateNew }: PlaylistModalProps) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (visible) {
      loadPlaylists();
      setIsCreating(false);
      setNewName('');
    }
  }, [visible]);

  const loadPlaylists = async () => {
    try {
      const res = await AsyncStorage.getItem('user_playlists');
      if (res) setPlaylists(JSON.parse(res));
    } catch (e) {
      console.error('Failed to load playlists', e);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCreateNew(newName.trim());
    setIsCreating(false);
    setNewName('');
  };

  const renderPlaylist = ({ item }: { item: any }) => (
    <Pressable
      style={styles.playlistItem}
      onPress={() => {
        Haptics.selectionAsync();
        onSelect(item.id);
      }}
    >
      <View style={styles.playlistArtContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.playlistArt} contentFit="cover" />
        ) : (
          <View style={[styles.playlistArt, styles.playlistArtPlaceholder]}>
            <ListMusic size={24} color={Theme.colors.textMuted} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.playlistCount}>{item.songs?.length || 0} tracks</Text>
      </View>
      <ChevronRight size={18} color={Theme.colors.textMuted} opacity={0.5} />
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={25} style={StyleSheet.absoluteFill} tint="dark" />
        </Pressable>

        <Animated.View entering={SlideInDown.duration(400)} style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{isCreating ? 'Create New Playlist' : 'Add to Playlist'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={24} color={Theme.colors.textMuted} />
            </Pressable>
          </View>

          {isCreating ? (
            <Animated.View entering={FadeInUp} style={styles.createContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter playlist name..."
                placeholderTextColor={Theme.colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={handleCreate}
              />
              <View style={styles.createActions}>
                <Pressable
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={() => setIsCreating(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.confirmBtn, !newName.trim() && { opacity: 0.5 }]}
                  onPress={handleCreate}
                  disabled={!newName.trim()}
                >
                  <Text style={styles.confirmText}>Create & Add</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <>
              <Pressable
                style={styles.createEntry}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsCreating(true);
                }}
              >
                <View style={styles.plusCircle}>
                  <Plus size={20} color="#fff" />
                </View>
                <Text style={styles.createText}>Create New Playlist</Text>
              </Pressable>

              <FlatList
                data={playlists}
                renderItem={renderPlaylist}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <ListMusic size={48} color={Theme.colors.textMuted} opacity={0.2} />
                    <Text style={styles.emptyText}>No playlists found. Create one above!</Text>
                  </View>
                }
              />
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  createEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.accent + '12',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Theme.colors.accent + '25',
  },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  createText: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.accent,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  playlistArtContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginRight: 16,
    overflow: 'hidden',
  },
  playlistArt: {
    width: '100%',
    height: '100%',
  },
  playlistArtPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  playlistCount: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  createContainer: {
    paddingBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  confirmBtn: {
    backgroundColor: Theme.colors.accent,
  },
  cancelText: {
    color: Theme.colors.text,
    fontWeight: '700',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: '80%',
  },
});
