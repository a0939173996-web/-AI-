import { Tabs } from 'expo-router';
import { Baby, BarChart3, Lightbulb } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#4F443B',
        tabBarStyle: {
          height: 64 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          backgroundColor: '#FFFDF9',
          borderTopColor: '#F0E5D8',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarItemStyle: { borderRadius: 24, marginHorizontal: 5, marginVertical: 4 },
      }}>
      <Tabs.Screen name="index" options={{ title: '監護儀表', tabBarIcon: ({ size, color }) => <Baby size={size} color={color} strokeWidth={2} />, tabBarActiveBackgroundColor: '#FF9F43' }} />
      <Tabs.Screen name="nightlight" options={{ title: '舒眠夜燈', tabBarIcon: ({ size, color }) => <Lightbulb size={size} color={color} strokeWidth={2} />, tabBarActiveBackgroundColor: '#FF9F43' }} />
      <Tabs.Screen name="report" options={{ title: '睡眠晨報', tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} strokeWidth={2} />, tabBarActiveBackgroundColor: '#FF9F43' }} />
    </Tabs>
  );
}
