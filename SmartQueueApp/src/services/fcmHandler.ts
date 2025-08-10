import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { NotificationService } from './notificationService';

// 웹 환경 체크
const isWeb = typeof window !== 'undefined';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class FCMHandler {
  private static expoPushToken: string | null = null;

  /**
   * FCM 초기화 및 토큰 획득
   */
  static async initializeFCM(userId: string): Promise<string | null> {
    try {
      // 웹 환경에서는 FCM 기능 제한
      if (isWeb) {
        console.log('웹 환경에서는 FCM 기능이 제한됩니다.');
        return null;
      }

      // 1. 알림 권한 요청
      const permissionGranted = await this.requestNotificationPermission();
      
      if (!permissionGranted) {
        console.log('알림 권한이 거부되었습니다.');
        return null;
      }

      // 2. Expo Push Token 획득
      const token = await this.getExpoPushToken();
      
      if (token) {
        // 3. 토큰을 서버에 저장
        await NotificationService.saveFCMToken(userId, token);
        this.expoPushToken = token;
        
        console.log('FCM 초기화 완료:', token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('FCM 초기화 오류:', error);
      return null;
    }
  }

  /**
   * 알림 권한 요청
   */
  static async requestNotificationPermission(): Promise<boolean> {
    try {
      // 이미 권한이 있는지 확인
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        await NotificationService.saveNotificationPermission(true);
        return true;
      }

      // 권한 요청
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      
      await NotificationService.saveNotificationPermission(granted);
      
      if (!granted) {
        console.log('알림 권한이 거부되었습니다.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('알림 권한 요청 오류:', error);
      return false;
    }
  }

  /**
   * Expo Push Token 획득
   */
  static async getExpoPushToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('시뮬레이터에서는 푸시 알림을 사용할 수 없습니다.');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'on-line-3000e', // Firebase 프로젝트 ID
      });

      return token.data;
    } catch (error) {
      console.error('Expo Push Token 획득 오류:', error);
      return null;
    }
  }

  /**
   * 알림 리스너 설정
   */
  static setupNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponse: (response: Notifications.NotificationResponse) => void
  ): () => void {
    // 포그라운드 알림 리스너
    const foregroundListener = Notifications.addNotificationReceivedListener(
      onNotificationReceived
    );

    // 알림 클릭 리스너
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      onNotificationResponse
    );

    // 리스너 정리 함수 반환
    return () => {
      Notifications.removeNotificationSubscription(foregroundListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * 로컬 알림 전송 (테스트용)
   */
  static async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // 즉시 전송
      });
    } catch (error) {
      console.error('로컬 알림 전송 오류:', error);
    }
  }

  /**
   * 예약된 알림 전송
   */
  static async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger,
      });

      return identifier;
    } catch (error) {
      console.error('예약 알림 설정 오류:', error);
      throw error;
    }
  }

  /**
   * 예약된 알림 취소
   */
  static async cancelScheduledNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.error('예약 알림 취소 오류:', error);
    }
  }

  /**
   * 모든 예약된 알림 취소
   */
  static async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('모든 예약 알림 취소 오류:', error);
    }
  }

  /**
   * 배지 카운트 설정
   */
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('배지 카운트 설정 오류:', error);
    }
  }

  /**
   * 배지 카운트 초기화
   */
  static async clearBadgeCount(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('배지 카운트 초기화 오류:', error);
    }
  }

  /**
   * 알림 채널 설정 (Android)
   */
  static async configureNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: '기본',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('queue-call', {
          name: '대기열 호출',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF3B30',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('event-update', {
          name: '이벤트 업데이트',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#34C759',
        });
      } catch (error) {
        console.error('알림 채널 설정 오류:', error);
      }
    }
  }

  /**
   * 현재 Expo Push Token 반환
   */
  static getCurrentToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * 토큰 갱신 처리
   */
  static async refreshToken(userId: string): Promise<string | null> {
    try {
      const newToken = await this.getExpoPushToken();
      
      if (newToken && newToken !== this.expoPushToken) {
        await NotificationService.saveFCMToken(userId, newToken);
        this.expoPushToken = newToken;
        console.log('FCM 토큰이 갱신되었습니다:', newToken);
      }
      
      return newToken;
    } catch (error) {
      console.error('토큰 갱신 오류:', error);
      return null;
    }
  }
}
