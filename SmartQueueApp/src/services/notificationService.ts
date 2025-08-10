import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Notification,
  NotificationData,
} from '../types/firestore';
import {
  convertNotificationToData,
  convertNotificationDataToFirestore,
  getCurrentTimestamp,
} from '../utils/firestoreUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class NotificationService {
  private static notificationsCollection = collection(db, 'notifications');
  private static fcmTokensCollection = collection(db, 'fcmTokens');

  // FCM 토큰 관련 상수
  private static readonly FCM_TOKEN_KEY = 'fcm_token';
  private static readonly NOTIFICATION_PERMISSION_KEY = 'notification_permission';

  /**
   * FCM 토큰을 Firestore에 저장합니다.
   */
  static async saveFCMToken(userId: string, token: string): Promise<void> {
    try {
      // 기존 토큰이 있는지 확인
      const existingTokenQuery = query(
        this.fcmTokensCollection,
        where('userId', '==', userId)
      );
      
      const existingTokenSnapshot = await getDocs(existingTokenQuery);
      
      if (!existingTokenSnapshot.empty) {
        // 기존 토큰 업데이트
        const tokenDoc = existingTokenSnapshot.docs[0];
        await updateDoc(doc(this.fcmTokensCollection, tokenDoc.id), {
          token,
          updatedAt: getCurrentTimestamp(),
        });
      } else {
        // 새 토큰 생성
        await addDoc(this.fcmTokensCollection, {
          userId,
          token,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        });
      }

      // 로컬 스토리지에도 저장
      await AsyncStorage.setItem(this.FCM_TOKEN_KEY, token);
      
      console.log('FCM 토큰이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('FCM 토큰 저장 오류:', error);
      throw new Error('FCM 토큰을 저장하는데 실패했습니다.');
    }
  }

  /**
   * 사용자의 FCM 토큰을 조회합니다.
   */
  static async getFCMToken(userId: string): Promise<string | null> {
    try {
      const tokenQuery = query(
        this.fcmTokensCollection,
        where('userId', '==', userId)
      );
      
      const tokenSnapshot = await getDocs(tokenQuery);
      
      if (tokenSnapshot.empty) {
        return null;
      }
      
      return tokenSnapshot.docs[0].data().token;
    } catch (error) {
      console.error('FCM 토큰 조회 오류:', error);
      return null;
    }
  }

  /**
   * 로컬에 저장된 FCM 토큰을 조회합니다.
   */
  static async getLocalFCMToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.FCM_TOKEN_KEY);
    } catch (error) {
      console.error('로컬 FCM 토큰 조회 오류:', error);
      return null;
    }
  }

  /**
   * 알림 권한 상태를 저장합니다.
   */
  static async saveNotificationPermission(granted: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(this.NOTIFICATION_PERMISSION_KEY, granted.toString());
    } catch (error) {
      console.error('알림 권한 상태 저장 오류:', error);
    }
  }

  /**
   * 알림 권한 상태를 조회합니다.
   */
  static async getNotificationPermission(): Promise<boolean> {
    try {
      const permission = await AsyncStorage.getItem(this.NOTIFICATION_PERMISSION_KEY);
      return permission === 'true';
    } catch (error) {
      console.error('알림 권한 상태 조회 오류:', error);
      return false;
    }
  }

  /**
   * 사용자의 알림 목록을 조회합니다.
   */
  static async getUserNotifications(userId: string): Promise<NotificationData[]> {
    try {
      const q = query(
        this.notificationsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const notifications: NotificationData[] = [];
      
      querySnapshot.forEach((doc) => {
        const notification = { id: doc.id, ...doc.data() } as Notification;
        notifications.push(convertNotificationToData(notification));
      });
      
      return notifications;
    } catch (error) {
      console.error('알림 목록 조회 오류:', error);
      throw new Error('알림 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 알림을 읽음 처리합니다.
   */
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const notificationDoc = doc(this.notificationsCollection, notificationId);
      await updateDoc(notificationDoc, {
        isRead: true,
        readAt: getCurrentTimestamp(),
      });
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      throw new Error('알림을 읽음 처리하는데 실패했습니다.');
    }
  }

  /**
   * 모든 알림을 읽음 처리합니다.
   */
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        this.notificationsCollection,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const updatePromises = querySnapshot.docs.map((doc) =>
        updateDoc(doc.ref, {
          isRead: true,
          readAt: getCurrentTimestamp(),
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      throw new Error('모든 알림을 읽음 처리하는데 실패했습니다.');
    }
  }

  /**
   * 알림을 삭제합니다.
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notificationDoc = doc(this.notificationsCollection, notificationId);
      await updateDoc(notificationDoc, {
        deletedAt: getCurrentTimestamp(),
      });
    } catch (error) {
      console.error('알림 삭제 오류:', error);
      throw new Error('알림을 삭제하는데 실패했습니다.');
    }
  }

  /**
   * 읽지 않은 알림 개수를 조회합니다.
   */
  static async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const q = query(
        this.notificationsCollection,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('읽지 않은 알림 개수 조회 오류:', error);
      return 0;
    }
  }

  /**
   * 실시간으로 사용자의 알림을 구독합니다.
   */
  static subscribeToUserNotifications(
    userId: string,
    callback: (notifications: NotificationData[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.notificationsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          const notifications: NotificationData[] = [];
          querySnapshot.forEach((doc) => {
            const notification = { id: doc.id, ...doc.data() } as Notification;
            notifications.push(convertNotificationToData(notification));
          });
          callback(notifications);
        },
        (error) => {
          console.error('알림 실시간 구독 오류:', error);
          onError?.(new Error('실시간 알림 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('알림 구독 설정 오류:', error);
      onError?.(new Error('알림 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 실시간으로 읽지 않은 알림 개수를 구독합니다.
   */
  static subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.notificationsCollection,
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          callback(querySnapshot.size);
        },
        (error) => {
          console.error('읽지 않은 알림 개수 구독 오류:', error);
          onError?.(new Error('실시간 알림 개수 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('읽지 않은 알림 개수 구독 설정 오류:', error);
      onError?.(new Error('알림 개수 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 대기열 호출 알림을 생성합니다.
   */
  static async createQueueCallNotification(
    userId: string,
    eventId: string,
    queueId: string,
    queueNumber: number,
    eventName: string
  ): Promise<void> {
    try {
      const notificationData: Partial<Notification> = {
        userId,
        type: 'queue_call',
        title: '대기열 호출',
        message: `${eventName} - ${queueNumber}번 순서입니다. 입장해주세요.`,
        isRead: false,
        eventId,
        queueId,
        createdAt: getCurrentTimestamp(),
      };
      
      await addDoc(this.notificationsCollection, notificationData);
    } catch (error) {
      console.error('대기열 호출 알림 생성 오류:', error);
      throw new Error('대기열 호출 알림을 생성하는데 실패했습니다.');
    }
  }

  /**
   * 이벤트 업데이트 알림을 생성합니다.
   */
  static async createEventUpdateNotification(
    userId: string,
    eventId: string,
    eventName: string,
    message: string
  ): Promise<void> {
    try {
      const notificationData: Partial<Notification> = {
        userId,
        type: 'event_update',
        title: '이벤트 업데이트',
        message,
        isRead: false,
        eventId,
        createdAt: getCurrentTimestamp(),
      };
      
      await addDoc(this.notificationsCollection, notificationData);
    } catch (error) {
      console.error('이벤트 업데이트 알림 생성 오류:', error);
      throw new Error('이벤트 업데이트 알림을 생성하는데 실패했습니다.');
    }
  }

  /**
   * 알림 타입별 아이콘을 반환합니다.
   */
  static getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'queue_call':
        return '🔔';
      case 'reminder':
        return '⏰';
      case 'queue_update':
        return '📊';
      case 'event_update':
        return '📢';
      default:
        return '📱';
    }
  }

  /**
   * 알림 타입별 색상을 반환합니다.
   */
  static getNotificationColor(type: Notification['type']): string {
    switch (type) {
      case 'queue_call':
        return '#FF3B30'; // 빨간색 (긴급)
      case 'reminder':
        return '#FF9500'; // 주황색 (리마인더)
      case 'queue_update':
        return '#007AFF'; // 파란색 (정보)
      case 'event_update':
        return '#34C759'; // 초록색 (업데이트)
      default:
        return '#8E8E93'; // 회색 (기본)
    }
  }
}
