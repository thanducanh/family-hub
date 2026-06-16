import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, SafeAreaView, TouchableOpacity, RefreshControl, Image, Platform } from 'react-native';
import { Users, Phone, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react-native';
import { api, API_BASE_URL } from '../../lib/api';

interface Member {
  id: string;
  name: string;
  nickname: string;
  birthday: string;
  gender: string;
  phone: string;
  avatarUrl: string;
  avatar: string;
  color: string;
}

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setError(null);
      const response = await api.get('/api/members');
      setMembers(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách thành viên');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembers();
  }, []);

  const getAvatarSource = (member: Member) => {
    const avatar = member.avatarUrl || member.avatar;
    if (!avatar) return null;
    if (avatar.startsWith('http')) return { uri: avatar };
    if (avatar.startsWith('data:image')) return { uri: avatar };
    return { uri: `${API_BASE_URL}${avatar.startsWith('/') ? '' : '/'}${avatar}` };
  };

  const calculateAge = (birthday: string) => {
    if (!birthday) return '';
    const ageDifMs = Date.now() - new Date(birthday).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) + ' tuổi';
  };

  const renderItem = ({ item }: { item: Member }) => {
    const avatarSource = getAvatarSource(item);
    
    return (
      <View style={[styles.card, { borderLeftColor: item.color || '#4f46e5' }]}>
        <View style={styles.avatarContainer}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: item.color || '#4f46e5' }]}>
              <Text style={styles.avatarText}>
                {item.name ? item.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{item.name}</Text>
          {item.nickname ? <Text style={styles.nickname}>({item.nickname})</Text> : null}
          
          <View style={styles.detailsRow}>
            {item.phone ? (
              <View style={styles.detailItem}>
                <Phone size={12} color="#64748b" />
                <Text style={styles.detailText}>{item.phone}</Text>
              </View>
            ) : null}
            
            {item.birthday ? (
              <View style={styles.detailItem}>
                <CalendarIcon size={12} color="#64748b" />
                <Text style={styles.detailText}>{item.birthday.split('-').reverse().join('/')} ({calculateAge(item.birthday)})</Text>
              </View>
            ) : null}
          </View>
          
          {item.notes ? (
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>
              Ghi chú: {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Users size={24} color="#4f46e5" />
          <Text style={styles.headerTitle}>Thành Viên</Text>
        </View>
      </View>

      <View style={styles.listContainer}>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchMembers}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : members.length > 0 ? (
          <FlatList
            data={members}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có thành viên nào.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: '#0f172a', marginLeft: 10 },
  listContainer: { flex: 1 },
  listContent: { padding: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '500' },
  infoContainer: { flex: 1 },
  name: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  nickname: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  detailsRow: { marginTop: 4 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  detailText: { fontSize: 13, color: '#475569', marginLeft: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#94a3b8', fontSize: 16 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', marginBottom: 12 },
  retryBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
});
