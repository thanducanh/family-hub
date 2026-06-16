import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useEffect, Component, ReactNode } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#ef4444', marginBottom: 10 }}>Ứng dụng gặp lỗi</Text>
          <Text style={{ textAlign: 'center', color: '#64748b', marginBottom: 20 }}>
            {this.state.error?.message || 'Có lỗi không xác định xảy ra.'}
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#fff', fontWeight: '500' }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function RootLayoutNav() {
  const { effectiveTheme, colors } = useSettings();
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    
    if (!token && inAuthGroup) {
      // Redirect to login if unauthenticated but trying to access tabs
      router.replace('/login');
    } else if (token && segments[0] === 'login') {
      // Redirect to tabs if authenticated but trying to access login
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ThemeProvider value={effectiveTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
