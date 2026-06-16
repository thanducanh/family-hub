import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Bell, Camera, CheckCircle2, Circle, Eye, Globe2, ImagePlus, LogOut, Moon, Settings, Sun, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Language, ThemeMode, useSettings } from '../../contexts/SettingsContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  createdByName: string;
  createdAt: string;
  isRead: boolean;
}

const copy = {
  vi: {
    profile: 'Cá nhân',
    settings: 'Cài đặt',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    logout: 'Đăng xuất',
    notifications: 'Thông báo mới',
    activity: 'Lịch sử hoạt động',
    emailFallback: 'Chưa có email',
    accountFallback: 'Tài khoản',
    markAll: 'Đánh dấu đã đọc',
    empty: 'Bạn không có thông báo nào.',
    confirmTitle: 'Đăng xuất',
    confirmMessage: 'Bạn có chắc muốn đăng xuất không?',
    deleteAvatarTitle: 'Xóa ảnh đại diện',
    deleteAvatarMessage: 'Bạn có chắc muốn xóa ảnh đại diện không?',
    avatar: 'Ảnh đại diện',
    viewAvatar: 'Xem avatar',
    changeAvatar: 'Thay ảnh đại diện',
    removeAvatar: 'Xóa ảnh đại diện',
    save: 'Lưu',
    cancel: 'Hủy',
    light: 'Sáng',
    dark: 'Tối',
    system: 'Theo hệ thống',
    vi: 'Tiếng Việt',
    en: 'English',
    ja: '日本語',
  },
  en: {
    profile: 'Profile',
    settings: 'Settings',
    language: 'Language',
    theme: 'Theme',
    logout: 'Logout',
    notifications: 'Notifications',
    activity: 'Activity',
    emailFallback: 'No email',
    accountFallback: 'Account',
    markAll: 'Mark all read',
    empty: 'You have no notifications.',
    confirmTitle: 'Logout',
    confirmMessage: 'Are you sure you want to logout?',
    deleteAvatarTitle: 'Remove avatar',
    deleteAvatarMessage: 'Are you sure you want to remove your avatar?',
    avatar: 'Avatar',
    viewAvatar: 'View avatar',
    changeAvatar: 'Change avatar',
    removeAvatar: 'Remove avatar',
    save: 'Save',
    cancel: 'Cancel',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    vi: 'Tiếng Việt',
    en: 'English',
    ja: '日本語',
  },
  ja: {
    profile: 'プロフィール',
    settings: '設定',
    language: '言語',
    theme: 'テーマ',
    logout: 'ログアウト',
    notifications: '通知',
    activity: 'アクティビティ',
    emailFallback: 'メール未設定',
    accountFallback: 'アカウント',
    markAll: 'すべて既読',
    empty: '通知はありません。',
    confirmTitle: 'ログアウト',
    confirmMessage: 'ログアウトしますか？',
    deleteAvatarTitle: 'アバター削除',
    deleteAvatarMessage: 'アバターを削除しますか？',
    avatar: 'アバター',
    viewAvatar: 'アバターを見る',
    changeAvatar: 'アバター変更',
    removeAvatar: 'アバター削除',
    save: '保存',
    cancel: 'キャンセル',
    light: 'ライト',
    dark: 'ダーク',
    system: 'システム',
    vi: 'Tiếng Việt',
    en: 'English',
    ja: '日本語',
  },
};

const languageOptions: { value: Language; labelKey: 'vi' | 'en' | 'ja' }[] = [
  { value: 'vi', labelKey: 'vi' },
  { value: 'en', labelKey: 'en' },
  { value: 'ja', labelKey: 'ja' },
];

const themeOptions: { value: ThemeMode; labelKey: 'light' | 'dark' | 'system'; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'light', icon: Sun },
  { value: 'dark', labelKey: 'dark', icon: Moon },
  { value: 'system', labelKey: 'system', icon: Settings },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser, setUserProfile } = useAuth();
  const { language, theme, colors, effectiveTheme, setLanguage, setTheme } = useSettings();
  const t = copy[language];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'language' | 'theme' | null>(null);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);

  const themed = useMemo(() => createThemedStyles(colors, effectiveTheme), [colors, effectiveTheme]);

  const displayName = user?.displayName || user?.fullName || user?.name || user?.username || user?.email || t.accountFallback;
  const email = user?.email || t.emailFallback;
  const avatarSource = user?.avatar || user?.avatarUrl || user?.avatar_url || user?.image || user?.photoUrl || user?.photo_url;
  const initial = String(displayName || t.accountFallback).charAt(0).toUpperCase();

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const doLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(t.confirmMessage)) void doLogout();
      return;
    }
    Alert.alert(t.confirmTitle, t.confirmMessage, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: doLogout },
    ]);
  };

  const buildProfilePayload = (avatar: string | null) => {
    const member = user?.member || {};
    const nextAvatar = avatar || '';
    return {
      displayName,
      email: user?.email || '',
      avatar: nextAvatar,
      avatarUrl: nextAvatar,
      memberId: user?.memberId || user?.member_id || member.id || '',
      name: member.name || user?.name || user?.displayName || displayName,
      nickname: member.nickname || '',
      phone: member.phone || '',
      birthday: member.birthday || '',
      gender: member.gender || '',
      notes: member.notes || '',
    };
  };

  const saveAvatar = async (avatar: string | null) => {
    try {
      setAvatarSaving(true);
      const result = await api.put('/api/auth/profile', buildProfilePayload(avatar));
      const nextUser = result.user || result.profile || result.data;
      if (nextUser) setUserProfile(nextUser);
      await refreshUser();
      setAvatarPreview(null);
      setAvatarMenuVisible(false);
      setAvatarViewerVisible(false);
    } catch (err: any) {
      Alert.alert(t.avatar, err?.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const pickAvatar = async () => {
    setAvatarMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.avatar, 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
    setAvatarPreview(uri);
  };

  const confirmRemoveAvatar = () => {
    setAvatarMenuVisible(false);
    const remove = () => saveAvatar(null);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(t.deleteAvatarMessage)) void remove();
      return;
    }
    Alert.alert(t.deleteAvatarTitle, t.deleteAvatarMessage, [
      { text: t.cancel, style: 'cancel' },
      { text: t.removeAvatar, style: 'destructive', onPress: remove },
    ]);
  };

  const markAsRead = async (id?: string) => {
    try {
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        await api.put('/api/notifications', { id });
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        await api.put('/api/notifications', {});
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[themed.notificationCard, !item.isRead && themed.notificationUnread]}
      onPress={() => !item.isRead && markAsRead(item.id)}
      activeOpacity={0.75}
    >
      <View style={themed.notificationIcon}>
        {item.isRead ? <CheckCircle2 size={22} color={colors.subtext} /> : <Circle size={22} color={colors.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[themed.notificationTitle, !item.isRead && { color: colors.text, fontWeight: '600' }]}>{item.title}</Text>
        <Text style={themed.notificationMessage} numberOfLines={2}>{item.message}</Text>
        <Text style={themed.notificationTime}>{formatTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={themed.profileContainer}>
      <View style={themed.profileCard}>
        <TouchableOpacity style={themed.avatarWrap} onPress={() => setAvatarMenuVisible(true)} activeOpacity={0.8}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={themed.avatarImage} />
          ) : (
            <View style={themed.avatarFallback}>
              <Text style={themed.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={themed.cameraBadge}>
            <Camera size={18} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <Text style={themed.profileName}>{displayName}</Text>
        <Text style={themed.profileEmail}>{email}</Text>
      </View>

      <View style={themed.menuContainer}>
        <TouchableOpacity style={themed.menuItem} activeOpacity={0.75}>
          <View style={[themed.menuIconBg, { backgroundColor: effectiveTheme === 'dark' ? '#451a03' : '#fef3c7' }]}>
            <Settings size={20} color="#d97706" />
          </View>
          <Text style={themed.menuText}>{t.activity}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={themed.menuItem} onPress={() => setSheet('language')} activeOpacity={0.75}>
          <View style={[themed.menuIconBg, { backgroundColor: effectiveTheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>
            <Globe2 size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={themed.menuText}>{t.language}</Text>
            <Text style={themed.menuSubtext}>{t[language]}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={themed.menuItem} onPress={() => setSheet('theme')} activeOpacity={0.75}>
          <View style={[themed.menuIconBg, { backgroundColor: effectiveTheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>
            {effectiveTheme === 'dark' ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={themed.menuText}>{t.theme}</Text>
            <Text style={themed.menuSubtext}>{t[theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : 'system']}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={themed.menuItem} onPress={handleLogout} activeOpacity={0.75}>
          <View style={[themed.menuIconBg, { backgroundColor: effectiveTheme === 'dark' ? '#7f1d1d' : '#fee2e2' }]}>
            <LogOut size={20} color="#ef4444" />
          </View>
          <Text style={[themed.menuText, { color: '#ef4444' }]}>{t.logout}</Text>
        </TouchableOpacity>
      </View>

      <View style={themed.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Bell size={20} color={colors.text} />
          <Text style={themed.sectionTitle}>{t.notifications}</Text>
        </View>
        <TouchableOpacity onPress={() => markAsRead()}>
          <Text style={themed.markAllText}>{t.markAll}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={themed.container}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={themed.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={themed.emptyContainer}>
              <Bell size={44} color={colors.subtext} style={{ marginBottom: 12 }} />
              <Text style={themed.emptyText}>{t.empty}</Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          )
        }
      />

      <OptionSheet
        visible={sheet === 'language'}
        title={t.language}
        onClose={() => setSheet(null)}
        colors={colors}
        options={languageOptions.map(option => ({
          key: option.value,
          label: t[option.labelKey],
          active: language === option.value,
          onPress: async () => {
            await setLanguage(option.value);
            setSheet(null);
          },
        }))}
      />

      <OptionSheet
        visible={avatarMenuVisible}
        title={t.avatar}
        onClose={() => setAvatarMenuVisible(false)}
        colors={colors}
        options={[
          {
            key: 'view',
            label: t.viewAvatar,
            active: false,
            Icon: Eye,
            onPress: () => {
              setAvatarMenuVisible(false);
              if (avatarSource) setAvatarViewerVisible(true);
            },
          },
          {
            key: 'change',
            label: t.changeAvatar,
            active: false,
            Icon: ImagePlus,
            onPress: pickAvatar,
          },
          {
            key: 'remove',
            label: t.removeAvatar,
            active: false,
            Icon: Trash2,
            onPress: confirmRemoveAvatar,
          },
        ]}
      />

      <AvatarPreviewModal
        visible={Boolean(avatarPreview)}
        uri={avatarPreview || ''}
        title={t.avatar}
        saveText={t.save}
        cancelText={t.cancel}
        saving={avatarSaving}
        colors={colors}
        onClose={() => setAvatarPreview(null)}
        onSave={() => avatarPreview && saveAvatar(avatarPreview)}
      />

      <AvatarPreviewModal
        visible={avatarViewerVisible && Boolean(avatarSource)}
        uri={avatarSource || ''}
        title={t.avatar}
        saveText=""
        cancelText={t.cancel}
        saving={false}
        colors={colors}
        onClose={() => setAvatarViewerVisible(false)}
      />

      <OptionSheet
        visible={sheet === 'theme'}
        title={t.theme}
        onClose={() => setSheet(null)}
        colors={colors}
        options={themeOptions.map(option => ({
          key: option.value,
          label: t[option.labelKey],
          active: theme === option.value,
          Icon: option.icon,
          onPress: async () => {
            await setTheme(option.value);
            setSheet(null);
          },
        }))}
      />
    </SafeAreaView>
  );
}

function OptionSheet({ visible, title, options, colors, onClose }: {
  visible: boolean;
  title: string;
  colors: ReturnType<typeof useSettings>['colors'];
  onClose: () => void;
  options: { key: string; label: string; active: boolean; Icon?: typeof Sun; onPress: () => void | Promise<void> }[];
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          {options.map(option => {
            const Icon = option.Icon;
            return (
              <TouchableOpacity key={option.key} style={[styles.optionRow, { borderColor: colors.border }, option.active && { backgroundColor: colors.primary + '18' }]} onPress={option.onPress} activeOpacity={0.75}>
                {Icon && <Icon size={20} color={option.active ? colors.primary : colors.subtext} />}
                <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
                {option.active && <Text style={[styles.optionCheck, { color: colors.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function AvatarPreviewModal({ visible, uri, title, saveText, cancelText, saving, colors, onClose, onSave }: {
  visible: boolean;
  uri: string;
  title: string;
  saveText: string;
  cancelText: string;
  saving: boolean;
  colors: ReturnType<typeof useSettings>['colors'];
  onClose: () => void;
  onSave?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Image source={{ uri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={[styles.previewButton, { backgroundColor: colors.background }]} onPress={onClose} disabled={saving}>
              <Text style={[styles.previewButtonText, { color: colors.subtext }]}>{cancelText}</Text>
            </TouchableOpacity>
            {onSave && (
              <TouchableOpacity style={[styles.previewButton, { backgroundColor: colors.primary }]} onPress={onSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.previewButtonText, { color: '#ffffff' }]}>{saveText}</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createThemedStyles(colors: { background: string; card: string; text: string; subtext: string; primary: string; border: string }, effectiveTheme: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingBottom: 110 },
    profileContainer: { padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 16 },
    profileCard: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 28,
      padding: 24,
      marginBottom: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: effectiveTheme === 'dark' ? 0.18 : 0.05,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarWrap: {
      width: 104,
      height: 104,
      marginBottom: 16,
    },
    avatarFallback: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: effectiveTheme === 'dark' ? '#312e81' : '#e0e7ff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: effectiveTheme === 'dark' ? '#334155' : '#e2e8f0',
    },
    cameraBadge: {
      position: 'absolute',
      right: 2,
      bottom: 6,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.card,
    },
    avatarText: { fontSize: 32, fontWeight: '600', color: colors.primary },
    profileName: { fontSize: 22, fontWeight: '600', color: colors.text, marginBottom: 4, textAlign: 'center' },
    profileEmail: { fontSize: 14, color: colors.subtext },
    menuContainer: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 8,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16 },
    menuIconBg: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    menuText: { fontSize: 16, fontWeight: '500', color: colors.text },
    menuSubtext: { marginTop: 2, fontSize: 13, color: colors.subtext },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 8 },
    markAllText: { color: colors.primary, fontWeight: '500', fontSize: 13 },
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      marginHorizontal: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.border,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notificationUnread: { borderLeftColor: colors.primary },
    notificationIcon: { marginRight: 16, paddingTop: 2 },
    notificationTitle: { fontSize: 16, fontWeight: '500', color: colors.text, marginBottom: 4, lineHeight: 22 },
    notificationMessage: { fontSize: 14, color: colors.subtext, marginBottom: 8, lineHeight: 20 },
    notificationTime: { fontSize: 12, color: colors.subtext },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 36 },
    emptyText: { color: colors.subtext, fontSize: 16, fontWeight: '400' },
  });
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  sheetTitle: { fontSize: 20, fontWeight: '600', marginBottom: 14 },
  optionRow: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: { flex: 1, fontSize: 16, fontWeight: '500' },
  optionCheck: { fontSize: 18, fontWeight: '600' },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
  },
  previewImage: {
    width: 240,
    height: 240,
    borderRadius: 120,
    marginVertical: 18,
    backgroundColor: '#e2e8f0',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  previewButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
