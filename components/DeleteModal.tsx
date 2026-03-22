import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Theme } from '@/constants/Theme';
import { Trash2 } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface DeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemImage: string;
}

export default function DeleteModal({ visible, onClose, onConfirm, itemName, itemImage }: DeleteModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
        </Pressable>
        
        <View style={styles.sheet}>
          <View style={styles.handle} />
          
          <Animated.View entering={FadeInUp.delay(100)} style={styles.content}>
            {itemImage ? (
              <Image source={{ uri: itemImage }} style={styles.image} contentFit="cover" />
            ) : null}
            <Text style={styles.title} numberOfLines={2}>Remove "{itemName}"?</Text>
            <Text style={styles.subtitle}>This song will be permanently removed from your offline device storage.</Text>
          </Animated.View>
          
          <Pressable style={styles.deleteBtn} onPress={onConfirm}>
            <Trash2 size={20} color="#fff" />
            <Text style={styles.deleteText}>Delete Download</Text>
          </Pressable>
          
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#1C1C1E', // standard iOS dark modal color, blends with Theme
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 24,
  },
  content: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  deleteBtn: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    paddingVertical: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: {
    color: Theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
