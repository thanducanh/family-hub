import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, Platform, Image } from 'react-native';
import { LogOut, Bell, PlusCircle, MinusCircle, CalendarPlus, Wallet, ArrowUpRight, ArrowDownRight, Activity, Search, Settings } from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  const [data, setData] = useState({
    totalIncomeYear: 0,
    totalExpenseYear: 0,
    balanceYear: 0,
    currentCash: 0,
    currentSavings: 0,
    currentInvestment: 0,
    estimatedAssets: 0,
    todayEvents: 0,
    newNotifs: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setError(null);
      
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const todayStr = today.toISOString().split('T')[0];

      const [financeRes, eventsRes, notifRes] = await Promise.all([
        api.get(`/api/finance-overview?year=${year}`),
        api.get(`/api/events?month=${month}&year=${year}`),
        api.get('/api/notifications').catch(err => {
          console.warn('[notifications]', err?.message || String(err));
          return { notifications: [] };
        })
      ]);

      const fData = financeRes.data || {};
      const monthlyData = fData.monthlyData || [];
      const totalIncomeYear = monthlyData.reduce((sum: number, m: any) => sum + (m.income || 0), 0);
      const totalExpenseYear = monthlyData.reduce((sum: number, m: any) => sum + (m.expense || 0), 0);
      const balanceYear = totalIncomeYear - totalExpenseYear;
      
      const todayEventsCount = (eventsRes.data || []).filter((e: any) => e.startDate === todayStr).length;
      const notifsArray = notifRes.notifications || notifRes.data || [];
      const newNotifsCount = notifsArray.filter((n: any) => !n.isRead).length;

      setData({
        totalIncomeYear,
        totalExpenseYear,
        balanceYear,
        currentCash: fData.currentCash || 0,
        currentSavings: fData.currentSavings || 0,
        currentInvestment: fData.currentInvestment || 0,
        estimatedAssets: fData.estimatedAssets || 0,
        todayEvents: todayEventsCount,
        newNotifs: newNotifsCount
      });
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối API.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout }
    ]);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };
  const avatarSource = user?.avatar || user?.avatarUrl || user?.avatar_url || user?.image || user?.photoUrl || user?.photo_url;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Zalo Style */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.userInfo} onPress={() => router.push('/notifications')}>
            <View style={styles.avatar}>
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.displayName?.[0] || user?.fullName?.[0] || user?.name?.[0] || user?.email?.[0] || 'T'}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>
                {user?.displayName || user?.fullName || user?.name || user?.email || 'Tài khoản'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.iconButton}>
            <Bell size={22} color="#64748b" />
            {data.newNotifs > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.searchBar}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Tìm kiếm...</Text>
        </TouchableOpacity>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error && !data.estimatedAssets ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1']} />}
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroTitle}>TỔNG TÀI SẢN ƯỚC TÍNH</Text>
              <Wallet size={20} color="#cbd5e1" />
            </View>
            <Text style={styles.heroAmount}>{formatCurrency(data.estimatedAssets)}</Text>
            <View style={styles.heroFooter}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Tiết kiệm</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(data.currentSavings)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Đầu tư</Text>
                <Text style={styles.heroStatValue}>{formatCurrency(data.currentInvestment)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/finance')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#064e3b' }]}>
                <ArrowDownRight size={22} color="#34d399" />
              </View>
              <Text style={styles.actionLabel}>Thêm thu</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/finance')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#450a0a' }]}>
                <ArrowUpRight size={22} color="#f87171" />
              </View>
              <Text style={styles.actionLabel}>Thêm chi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/calendar')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#1e1b4b' }]}>
                <CalendarPlus size={22} color="#818cf8" />
              </View>
              <Text style={styles.actionLabel}>Sự kiện</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/notifications')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#3f3f46' }]}>
                <Bell size={22} color="#a1a1aa" />
              </View>
              <Text style={styles.actionLabel}>Thông báo</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Tài chính */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tài chính</Text>
          </View>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Dòng tiền thực còn</Text>
              <Text style={[styles.metricValue, { color: '#818cf8' }]}>{formatCurrency(data.currentCash)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Dư sau chi</Text>
              <Text style={[styles.metricValue, { color: data.balanceYear >= 0 ? '#34d399' : '#f87171' }]}>
                {formatCurrency(data.balanceYear)}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Tổng thu năm</Text>
              <Text style={[styles.metricValue, { color: '#34d399' }]}>{formatCurrency(data.totalIncomeYear)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Tổng chi năm</Text>
              <Text style={[styles.metricValue, { color: '#f87171' }]}>{formatCurrency(data.totalExpenseYear)}</Text>
            </View>
          </View>

          {/* Section: Hoạt động */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hoạt động</Text>
            <TouchableOpacity onPress={() => router.push('/calendar')}>
              <Text style={styles.seeAllText}>Xem lịch</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityCard}>
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: '#fdba74' }]}>
                <Activity size={20} color="#9a3412" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Sự kiện hôm nay</Text>
                <Text style={styles.activityDesc}>
                  {data.todayEvents > 0 ? `Bạn có ${data.todayEvents} sự kiện trong ngày` : 'Không có sự kiện nào'}
                </Text>
              </View>
              <Text style={styles.activityCount}>{data.todayEvents}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: '#fca5a5' }]}>
                <Bell size={20} color="#991b1b" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Thông báo mới</Text>
                <Text style={styles.activityDesc}>
                  {data.newNotifs > 0 ? `Có ${data.newNotifs} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
                </Text>
              </View>
              <Text style={[styles.activityCount, data.newNotifs > 0 && { color: '#ef4444' }]}>
                {data.newNotifs}
              </Text>
            </View>
          </View>
          
          <View style={{ height: 100 }} /> 
        </ScrollView>
      )}

      {/* Settings FAB */}
      <TouchableOpacity 
        style={styles.settingsFab} 
        onPress={() => router.push('/notifications')}
      >
        <Settings size={24} color="#4f46e5" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#4f46e5',
  },
  greeting: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  content: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#4f46e5',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e0e7ff',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 16,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#e0e7ff',
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  heroDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  actionBtn: {
    alignItems: 'center',
    width: '23%',
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    width: '48%',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 4,
  },
  activityDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  activityCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  centerContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 14,
  },
  settingsFab: {
    position: 'absolute',
    right: 20,
    bottom: 90, // Above the tab bar
    backgroundColor: '#ffffff',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
});
