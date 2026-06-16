import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, Users, Calendar, Wallet, CircleUser } from 'lucide-react-native';
import { useSettings } from '@/contexts/SettingsContext';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, effectiveTheme } = useSettings();
  return (
    <SafeAreaView style={[styles.tabBarContainer, { backgroundColor: colors.card }]}>
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border, shadowOpacity: effectiveTheme === 'dark' ? 0.18 : 0.05 }]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Define Icon component
          let IconComponent = Home;
          if (route.name === 'members') IconComponent = Users;
          if (route.name === 'calendar') IconComponent = Calendar;
          if (route.name === 'finance') IconComponent = Wallet;
          if (route.name === 'notifications') IconComponent = CircleUser; // Changed to User icon

          // Special Center Button for Dashboard (index)
          if (route.name === 'index') {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.centerButtonContainer}
              >
                <View style={[styles.centerButtonOuter, { backgroundColor: colors.background }]}>
                  <View style={[styles.centerButtonInner, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                    <IconComponent size={28} color="#ffffff" />
                  </View>
                </View>
                <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.subtext }, isFocused ? styles.tabLabelActive : {}]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.iconContainer, isFocused && { backgroundColor: effectiveTheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>
                <IconComponent size={22} color={isFocused ? colors.primary : colors.subtext} />
              </View>
              <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.subtext }, isFocused ? styles.tabLabelActive : {}]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="members" options={{ title: 'Thành viên' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Lịch' }} />
      <Tabs.Screen name="index" options={{ title: 'Tổng quan' }} />
      <Tabs.Screen name="finance" options={{ title: 'Thu chi' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Cá nhân' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#ffffff', // Ensures the safe area bottom is light
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    height: 70,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    padding: 8,
    borderRadius: 16,
    marginBottom: 4,
  },
  iconContainerActive: {
    backgroundColor: '#e0e7ff', 
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94a3b8',
  },
  tabLabelActive: {
    color: '#4f46e5',
    fontWeight: '500',
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  centerButtonOuter: {
    top: -20, // Elevate above the tab bar
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc', // Cutout wrapper matches screen bg
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -24, // Pull the label up closer
  },
  centerButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
