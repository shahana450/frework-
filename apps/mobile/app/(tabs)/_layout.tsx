import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: 4 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 9, fontWeight: focused ? '800' : '500', color: focused ? '#60A5FA' : 'rgba(148,163,184,0.6)' }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F2044',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="services"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="✅" label="Services" focused={focused} /> }}
      />
      <Tabs.Screen
        name="coworking"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏛️" label="Coworking" focused={focused} /> }}
      />
      <Tabs.Screen
        name="freelancers"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Hire" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tabs>
  );
}
