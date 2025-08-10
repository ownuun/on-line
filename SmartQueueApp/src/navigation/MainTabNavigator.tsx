import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueueScreen } from '../screens/QueueScreen';
import { TicketUploadScreen } from '../screens/TicketUploadScreen';
import { NotificationScreen } from '../screens/NotificationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/notificationService';

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // 읽지 않은 알림 개수 구독
  useEffect(() => {
    if (!user) return;

    const unsubscribe = NotificationService.subscribeToUnreadCount(
      user.uid,
      (count) => {
        setUnreadCount(count);
      },
      (error) => {
        console.error('알림 개수 구독 오류:', error);
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
        },
      }}
    >
      <Tab.Screen
        name="Queue"
        component={QueueScreen}
        options={{
          tabBarLabel: '대기열',
          tabBarIcon: ({ color, size }) => (
            <div style={{ 
              width: size, 
              height: size, 
              backgroundColor: color,
              borderRadius: size / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.6,
              color: '#FFFFFF'
            }}>
              Q
            </div>
          ),
        }}
      />
      <Tab.Screen
        name="Ticket"
        component={TicketUploadScreen}
        options={{
          tabBarLabel: '티켓',
          tabBarIcon: ({ color, size }) => (
            <div style={{ 
              width: size, 
              height: size, 
              backgroundColor: color,
              borderRadius: size / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.6,
              color: '#FFFFFF'
            }}>
              T
            </div>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarLabel: '알림',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <div style={{
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: size / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.6,
              color: '#FFFFFF'
            }}>
              N
            </div>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: '프로필',
          tabBarIcon: ({ color, size }) => (
            <div style={{ 
              width: size, 
              height: size, 
              backgroundColor: color,
              borderRadius: size / 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.6,
              color: '#FFFFFF'
            }}>
              P
            </div>
          ),
        }}
      />
    </Tab.Navigator>
  );
};
