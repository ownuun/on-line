import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { MainTabNavigator } from './src/navigation/MainTabNavigator';
import { AdminNavigator } from './src/navigation/AdminNavigator';
import { QueueDetailScreen } from './src/screens/QueueDetailScreen';
import { QueueStatusScreen } from './src/screens/QueueStatusScreen';
import { FCMHandler } from './src/services/fcmHandler';
import { NotificationService } from './src/services/notificationService';
import { AdminService } from './src/services/adminService';

// 네비게이션 타입
const Stack = createStackNavigator();

// 인증 스택 네비게이터
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

// 메인 스택 네비게이터 (일반 사용자용)
const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabNavigator} />
    <Stack.Screen name="QueueDetail" component={QueueDetailScreen} />
    <Stack.Screen name="QueueStatus" component={QueueStatusScreen} />
  </Stack.Navigator>
);

// 메인 앱 컴포넌트
const AppContent = () => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdminRole = async () => {
      if (user) {
        try {
          const adminStatus = await AdminService.checkCurrentUserAdminRole();
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error('관리자 권한 확인 오류:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  // FCM 초기화 및 알림 리스너 설정
  useEffect(() => {
    const initializeNotifications = async () => {
      if (user) {
        try {
          // FCM 초기화
          await FCMHandler.initializeFCM(user.uid);
          
          // 알림 채널 설정 (Android)
          await FCMHandler.configureNotificationChannels();
          
          console.log('알림 시스템이 초기화되었습니다.');
        } catch (error) {
          console.error('알림 시스템 초기화 오류:', error);
        }
      }
    };

    initializeNotifications();
  }, [user]);

  if (loading || isAdmin === null) {
    // 로딩 화면
    return (
      <div style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#FFFFFF'
      }}>
        <div style={{ fontSize: 18, color: '#007AFF' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {user ? (
        isAdmin ? <AdminNavigator /> : <MainStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
};

// 루트 앱 컴포넌트
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
