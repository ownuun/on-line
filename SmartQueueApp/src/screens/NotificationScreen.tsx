import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/notificationService';
import { NotificationData } from '../types/firestore';
import { formatDateTime } from '../utils/firestoreUtils';

export const NotificationScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // 알림 목록 로드
  useEffect(() => {
    if (user) {
      loadNotifications();
      setupNotificationListeners();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const userNotifications = await NotificationService.getUserNotifications(user!.uid);
      setNotifications(userNotifications);
      
      const count = await NotificationService.getUnreadNotificationCount(user!.uid);
      setUnreadCount(count);
    } catch (error) {
      console.error('알림 로드 오류:', error);
      Alert.alert('오류', '알림 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const setupNotificationListeners = () => {
    if (!user) return;

    // 실시간 알림 구독
    const unsubscribeNotifications = NotificationService.subscribeToUserNotifications(
      user.uid,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
      },
      (error) => {
        console.error('알림 구독 오류:', error);
      }
    );

    // 읽지 않은 알림 개수 구독
    const unsubscribeUnreadCount = NotificationService.subscribeToUnreadCount(
      user.uid,
      (count) => {
        setUnreadCount(count);
      },
      (error) => {
        console.error('읽지 않은 알림 개수 구독 오류:', error);
      }
    );

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      Alert.alert('오류', '알림을 읽음 처리하는데 실패했습니다.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await NotificationService.deleteNotification(notificationId);
    } catch (error) {
      console.error('알림 삭제 오류:', error);
      Alert.alert('오류', '알림을 삭제하는데 실패했습니다.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllNotificationsAsRead(user!.uid);
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      Alert.alert('오류', '모든 알림을 읽음 처리하는데 실패했습니다.');
    }
  };

  if (loading) {
    return <Loader text="알림 목록을 불러오는 중..." fullScreen />;
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      bounces={true}
    >
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <Text style={styles.subtitle}>
          {unreadCount}개의 읽지 않은 알림
        </Text>
      </View>

      <View style={styles.notificationList}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>알림이 없습니다</Text>
            <Text style={styles.emptyStateSubtext}>
              새로운 알림이 오면 여기에 표시됩니다
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.isRead && styles.unreadCard
              ]}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.notificationIcon}>
                  <Text style={styles.iconText}>
                    {NotificationService.getNotificationIcon(notification.type)}
                  </Text>
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTimestamp}>
                    {formatDateTime(notification.createdAt)}
                  </Text>
                </View>
                <View style={styles.notificationActions}>
                  {!notification.isRead && (
                    <TouchableOpacity
                      onPress={() => markAsRead(notification.id)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>읽음</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => deleteNotification(notification.id)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                      삭제
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {notifications.length > 0 && unreadCount > 0 && (
        <View style={styles.buttonContainer}>
          <Button
            title="모든 알림 읽음 처리"
            onPress={markAllAsRead}
            style={styles.markAllReadButton}
          />
        </View>
      )}

      {/* 뒤로가기 버튼 */}
      <View style={styles.backButtonContainer}>
        <Button
          title="뒤로가기"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.backButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingBottom: 100, // 하단 패딩 추가
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  notificationList: {
    padding: 20,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTimestamp: {
    fontSize: 12,
    color: '#C7C7CC',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F2F2F7',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 20,
    marginBottom: 20,
  },
  markAllReadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
  },
  backButtonContainer: {
    padding: 20,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5EA',
    borderWidth: 1,
  },
});
