import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Share,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Shield,
  Info,
  Heart,
  Star,
  Share2,
  LogOut,
  Trash2,
  HardDrive,
  Headphones,
  Music,
  Download,
  Zap,
  CheckCircle2,
  X,
  Check
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { Theme } from '@/constants/Theme';
import { useSettings, SUPPORTED_LANGUAGES, AudioQuality } from '@/context/SettingsContext';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInUp,
  Layout,
  FadeOut
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Human-readable labels for audio quality
const QUALITY_LABELS: Record<AudioQuality, { label: string, desc: string }> = {
  '12kbps': { label: 'Data Saver', desc: 'Minimal data usage, lower fidelity' },
  '48kbps': { label: 'Low', desc: 'Good for weak connections' },
  '96kbps': { label: 'Normal', desc: 'Standard mobile quality' },
  '160kbps': { label: 'High', desc: 'Clear sound, moderate data' },
  '320kbps': { label: 'Extreme', desc: 'Best possible experience' },
};

export default function SettingsScreen() {
  const router = useRouter();
  const {
    primaryLanguage,
    setPrimaryLanguage,
    audioQuality,
    setAudioQuality,
    clearCache,
    getCacheSize
  } = useSettings();

  const [cacheSize, setCacheSize] = useState('0 MB');
  const [activeModal, setActiveModal] = useState<'none' | 'language' | 'quality' | 'clear' | 'privacy' | 'about'>('none');

  useEffect(() => {
    updateCacheSize();
  }, [clearCache]);

  const updateCacheSize = async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Experience the magic of Songeet - Your premium Indian music player. Get it now! ✨',
        url: 'https://github.com/SumanBlswas/beatit-new',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const closeModal = () => setActiveModal('none');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Theme.colors.accentLight + '30', Theme.colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={15}>
          <ChevronLeft size={24} color={Theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Animated.View entering={FadeInDown.delay(100)}>
          <LinearGradient
            colors={[Theme.colors.ink, '#1B2C23']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.accountCard}
          >
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>S</Text>
              </View>
              <View style={styles.proBadge}>
                <Star size={10} color={Theme.colors.white} fill={Theme.colors.white} />
                <Text style={styles.proText}>PRO MEMBER</Text>
              </View>
            </View>

            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: '#fff' }]}>Songeet Premium</Text>
              <Text style={[styles.accountStatus, { color: 'rgba(255,255,255,0.6)' }]}>Lifetime Access • Unlimited High Quality</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.versionText}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
              <View style={styles.statusDot} />
              <Text style={styles.activeLabel}>Active</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.divider} />

        {/* Music Language */}
        <Text style={styles.sectionLabel}>Music Settings</Text>
        <OptionRow
          icon={<Globe size={18} color={Theme.colors.accent} />}
          title="Primary Language"
          value={SUPPORTED_LANGUAGES.find(l => l.code === primaryLanguage)?.name || 'Hindi'}
          onPress={() => setActiveModal('language')}
        />
        <OptionRow
          icon={<Music size={18} color={Theme.colors.accent} />}
          title="Streaming Quality"
          value={QUALITY_LABELS[audioQuality].label}
          onPress={() => setActiveModal('quality')}
        />

        <View style={styles.divider} />

        {/* Data & Storage */}
        <Text style={styles.sectionLabel}>Storage</Text>
        <OptionRow
          icon={<Trash2 size={18} color={Theme.colors.accent} />}
          title="Clear Cache"
          value={cacheSize}
          onPress={() => setActiveModal('clear')}
        />

        <View style={styles.divider} />

        {/* Support */}
        <Text style={styles.sectionLabel}>Support & Info</Text>
        <View style={styles.optionsList}>
          <OptionRow icon={<Shield size={18} color={Theme.colors.textMuted} />} title="Privacy Policy" onPress={() => setActiveModal('privacy')} />
          <OptionRow icon={<Heart size={18} color={Theme.colors.textMuted} />} title="Share Songeet" onPress={handleShare} />
          <OptionRow icon={<Info size={18} color={Theme.colors.textMuted} />} title="About Dev" onPress={() => setActiveModal('about')} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Songeet Premium Music</Text>
          <Text style={styles.versionText}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </ScrollView>

      {/* MODALS */}
      <CustomModal
        visible={activeModal !== 'none'}
        onClose={closeModal}
        title={
          activeModal === 'language' ? "Choose Language" :
            activeModal === 'quality' ? "Audio Quality" :
              activeModal === 'clear' ? "Clear Cache" :
                activeModal === 'privacy' ? "Privacy Policy" : "About Developer"
        }
      >
        {activeModal === 'language' && (
          <View style={styles.modalScrollWrap}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectionItem
                key={lang.code}
                title={lang.name}
                subtitle={lang.nativeName}
                selected={primaryLanguage === lang.code}
                onPress={() => {
                  setPrimaryLanguage(lang.code);
                  closeModal();
                }}
              />
            ))}
          </View>
        )}

        {activeModal === 'quality' && (
          <View style={styles.modalScrollWrap}>
            {(Object.keys(QUALITY_LABELS) as AudioQuality[]).map((q) => (
              <SelectionItem
                key={q}
                title={QUALITY_LABELS[q].label}
                subtitle={QUALITY_LABELS[q].desc}
                selected={audioQuality === q}
                onPress={() => {
                  setAudioQuality(q);
                  closeModal();
                }}
              />
            ))}
          </View>
        )}

        {activeModal === 'clear' && (
          <View style={styles.modalContentBody}>
            <Text style={styles.modalText}>
              Are you sure you want to clear the application cache? This will free up <Text style={{ fontWeight: '800' }}>{cacheSize}</Text> of space. Your downloaded songs will remain safe.
            </Text>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: '#FF4757' }]}
              onPress={async () => {
                await clearCache();
                updateCacheSize();
                closeModal();
              }}
            >
              <Text style={styles.modalBtnText}>Clear Cache</Text>
            </Pressable>
          </View>
        )}

        {activeModal === 'privacy' && (
          <View style={styles.modalContentBody}>
            <Text style={styles.modalText}>
              Songeet respects your privacy. We do not collect or sell your personal playback data. Your downloads and settings are stored locally on your device.
            </Text>
            <Text style={[styles.modalText, { marginTop: 12, opacity: 0.6 }]}>
              © 2026 Songeet Team. Built with end-to-end security.
            </Text>
            <Pressable style={styles.modalBtn} onPress={closeModal}>
              <Text style={styles.modalBtnText}>Understood</Text>
            </Pressable>
          </View>
        )}

        {activeModal === 'about' && (
          <View style={styles.modalContentBody}>
            <View style={styles.devCard}>
              <View style={styles.devAvatar}><Text style={styles.devAvatarText}>S</Text></View>
              <View>
                <Text style={styles.devName}>Suman Biswas</Text>
                <Text style={styles.devTitle}>Lead Developer</Text>
              </View>
            </View>
            <Text style={styles.modalText}>
              Crafted with a vision to provide a premium, ad-free music experience to everyone. Special thanks to the community for supporting the "Beat It" project.
            </Text>
            <Pressable style={styles.modalBtn} onPress={closeModal}>
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        )}
      </CustomModal>
    </View>
  );
}

function OptionRow({ icon, title, value, onPress }: any) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={styles.iconCircle}>{icon}</View>
        <Text style={styles.rowTitle}>{title}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <ChevronRight size={18} color={Theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function SelectionItem({ title, subtitle, selected, onPress }: any) {
  return (
    <Pressable
      style={[styles.selItem, selected && styles.selItemActive]}
      onPress={onPress}
    >
      <View>
        <Text style={[styles.selTitle, selected && styles.selTitleActive]}>{title}</Text>
        {subtitle && <Text style={[styles.selSub, selected && styles.selSubActive]}>{subtitle}</Text>}
      </View>
      {selected && (
        <Animated.View entering={FadeIn}>
          <Check size={20} color={Theme.colors.white} />
        </Animated.View>
      )}
    </Pressable>
  );
}

function CustomModal({ visible, onClose, title, children }: any) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
        </Pressable>

        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOut}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: { paddingTop: 64, paddingBottom: 20, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border },
  headerTitle: { fontSize: 24, fontFamily: Theme.typography.family.serif, fontWeight: '800', color: Theme.colors.text, marginLeft: 16, letterSpacing: -0.5 },
  scrollContent: { paddingBottom: 100 },
  accountCard: { padding: 24, marginHorizontal: 24, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 8, marginTop: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  accountInfo: { marginBottom: 20 },
  accountName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  accountStatus: { fontSize: 13, marginTop: 6, fontWeight: '600' },
  proBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  proText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  versionText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CD964', marginLeft: 12, marginRight: 6 },
  activeLabel: { fontSize: 11, color: '#4CD964', fontWeight: '800', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginVertical: 12, marginHorizontal: 24, opacity: 0.5 },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: Theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 15, marginBottom: 15, paddingHorizontal: 24 },
  optionsList: { paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 24, marginBottom: 4 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconCircle: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(125, 140, 105, 0.1)', justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: Theme.colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowValue: { fontSize: 14, color: Theme.colors.accent, fontWeight: '800', opacity: 0.9 },
  footer: { marginTop: 60, alignItems: 'center', opacity: 0.4 },
  footerText: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: Theme.colors.text },
  footerSub: { fontSize: 11, marginTop: 6, fontWeight: '600', color: Theme.colors.textMuted },

  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContainer: { height: height * 0.65, backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 8 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Theme.colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.colors.border + '50', justifyContent: 'center', alignItems: 'center' },
  modalBody: { flex: 1 },
  modalScrollWrap: { gap: 12, paddingBottom: 20 },
  modalContentBody: { padding: 12 },
  modalText: { fontSize: 16, lineHeight: 24, color: Theme.colors.text, fontWeight: '500' },
  modalBtn: { backgroundColor: Theme.colors.ink, paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 32 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  selItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderRadius: 22, backgroundColor: Theme.colors.border + '30', borderWidth: 1, borderColor: 'transparent' },
  selItemActive: { backgroundColor: Theme.colors.accent, borderColor: Theme.colors.accent },
  selTitle: { fontSize: 16, fontWeight: '800', color: Theme.colors.text },
  selTitleActive: { color: '#fff' },
  selSub: { fontSize: 12, color: Theme.colors.textMuted, marginTop: 4, fontWeight: '600' },
  selSubActive: { color: 'rgba(255,255,255,0.7)' },

  devCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, backgroundColor: Theme.colors.border + '20', padding: 16, borderRadius: 20 },
  devAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: Theme.colors.accent, justifyContent: 'center', alignItems: 'center' },
  devAvatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  devName: { fontSize: 18, fontWeight: '800', color: Theme.colors.text },
  devTitle: { fontSize: 12, color: Theme.colors.textMuted, fontWeight: '600' },
});
