import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { TOManagementScreen } from '../screens/admin/TOManagementScreen';
import { QueueMonitoringScreen } from '../screens/admin/QueueMonitoringScreen';
import { ManualReviewScreen } from '../screens/admin/ManualReviewScreen';
import { EventManagementScreen } from '../screens/admin/EventManagementScreen';
import { Text, View } from 'react-native';

const Tab = createBottomTabNavigator();

// 간단한 아이콘 컴포넌트 (실제로는 react-native-vector-icons 사용 권장)
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const getIconText = () => {
    switch (name) {
      case 'Dashboard':
        return '📊';
      case 'EventManagement':
        return '🎪';
      case 'TOManagement':
        return '⚙️';
      case 'QueueMonitoring':
        return '📱';
      case 'ManualReview':
        return '👁️';
      default:
        return '📋';
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{getIconText()}</Text>
    </View>
  );
};

export const AdminNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: '대시보드',
        }}
      />
      
      <Tab.Screen
        name="EventManagement"
        component={EventManagementScreen}
        options={{
          tabBarLabel: '이벤트 관리',
        }}
      />
      
      <Tab.Screen
        name="TOManagement"
        component={TOManagementScreen}
        options={{
          tabBarLabel: 'TO 설정',
        }}
      />
      
      <Tab.Screen
        name="QueueMonitoring"
        component={QueueMonitoringScreen}
        options={{
          tabBarLabel: '호출 현황',
        }}
      />
      
      <Tab.Screen
        name="ManualReview"
        component={ManualReviewScreen}
        options={{
          tabBarLabel: '수동 검수',
        }}
      />
    </Tab.Navigator>
  );
};
