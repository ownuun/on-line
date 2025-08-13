import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { QueueService } from '../services/queueService';
import { EventService } from '../services/eventService';
import { useAuth } from '../contexts/AuthContext';
import { QueueData, EventData, TimeSlotData } from '../types/firestore';
import { logError, getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { formatDate } from '../utils/firestoreUtils';

type QueueStatusNavigationProp = StackNavigationProp<RootStackParamList, 'QueueStatus'>;

export const QueueStatusScreen: React.FC = () => {
  const navigation = useNavigation<QueueStatusNavigationProp>();
  const { user } = useAuth();
  const [queues, setQueues] = useState<QueueData[]>([]);
  const [events, setEvents] = useState<{ [key: string]: EventData }>({});
  const [timeSlots, setTimeSlots] = useState<{ [key: string]: TimeSlotData }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingQueueId, setCancellingQueueId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUserQueues();
    }
  }, [user]);

  const loadUserQueues = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userQueues = await QueueService.getUserQueues(user.uid);
      setQueues(userQueues);

      // 각 대기열의 이벤트와 타임슬롯 정보 로드
      const eventPromises = userQueues.map(async (queue) => {
        try {
          const event = await EventService.getEventById(queue.eventId);
          return { queueId: queue.id, event };
        } catch (error) {
          console.error(`이벤트 로드 실패 (${queue.eventId}):`, error);
          return { queueId: queue.id, event: null };
        }
      });

      const timeSlotPromises = userQueues.map(async (queue) => {
        try {
          const timeSlot = await EventService.getTimeSlotById(queue.timeSlotId);
          return { queueId: queue.id, timeSlot };
        } catch (error) {
          console.error(`타임슬롯 로드 실패 (${queue.timeSlotId}):`, error);
          return { queueId: queue.id, timeSlot: null };
        }
      });

      const [eventResults, timeSlotResults] = await Promise.all([
        Promise.all(eventPromises),
        Promise.all(timeSlotPromises),
      ]);

      const eventMap: { [key: string]: EventData } = {};
      const timeSlotMap: { [key: string]: TimeSlotData } = {};

      eventResults.forEach(({ queueId, event }) => {
        if (event) eventMap[queueId] = event;
      });

      timeSlotResults.forEach(({ queueId, timeSlot }) => {
        if (timeSlot) timeSlotMap[queueId] = timeSlot;
      });

      setEvents(eventMap);
      setTimeSlots(timeSlotMap);
    } catch (error) {
      logError('QueueStatusScreen.loadUserQueues', error);
      Alert.alert('오류', '대기열 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserQueues();
    setRefreshing(false);
  };

  const handleCancelQueue = async (queueId: string) => {
    // Alert 다이얼로그 없이 바로 취소 시도
    try {
      console.log('QueueStatusScreen: 대기열 취소 시작 - queueId:', queueId);
      setCancellingQueueId(queueId);
      
      await QueueService.cancelQueue(queueId, user!.uid);
      console.log('QueueStatusScreen: 대기열 취소 성공');
      
      // 대기열 목록 새로고침
      await loadUserQueues();
      
      console.log('QueueStatusScreen: 대기열 취소 성공');
      
      // 모든 대기열이 없어지면 뒤로가기
      if (queues.length === 0) {
        console.log('QueueStatusScreen: 모든 대기열이 없어짐 - 뒤로가기 실행');
        navigation.goBack();
      }
    } catch (error) {
      console.error('QueueStatusScreen: 대기열 취소 실패:', error);
      logError('QueueStatusScreen.handleCancelQueue', error);
      
      let errorMessage = '대기열 취소에 실패했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert('취소 실패', errorMessage);
    } finally {
      setCancellingQueueId(null);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#FF9500'; // 대기 중
      case 'called':
        return '#4CAF50'; // 호출됨
      case 'entered':
        return '#007AFF'; // 입장 완료
      case 'cancelled':
        return '#FF3B30'; // 취소됨
      default:
        return '#8E8E93'; // 기본 색상
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return '대기 중';
      case 'called':
        return '호출됨';
      case 'entered':
        return '입장 완료';
      case 'cancelled':
        return '취소됨';
      default:
        return '알 수 없음';
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'waiting':
        return 0;
      case 'called':
        return 50;
      case 'entered':
        return 100;
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#FF9500'; // 대기 중
      case 'called':
        return '#4CAF50'; // 호출됨
      case 'entered':
        return '#007AFF'; // 입장 완료
      case 'cancelled':
        return '#FF3B30'; // 취소됨
      default:
        return '#8E8E93'; // 기본 색상
    }
  };

  if (loading) {
    return <Loader text="대기열 정보를 불러오는 중..." fullScreen />;
  }

  if (queues.length === 0) {
    return (
      <View 
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>대기열 상태</Text>
          <Text style={styles.subtitle}>현재 등록된 대기열이 없습니다</Text>
        </View>
        
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            대기열에 등록하면 여기서 상태를 확인할 수 있습니다
          </Text>
          <Button
            title="새로고침"
            onPress={onRefresh}
            variant="outline"
            style={styles.refreshButton}
          />
        </View>
        
        {/* 뒤로가기 버튼 */}
        <View style={styles.backButtonContainer}>
          <Button
            title="뒤로가기"
            onPress={() => {
              // 네비게이션 스택에서 뒤로가기
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
            variant="outline"
            style={styles.backButton}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      bounces={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>대기열 상태</Text>
        <Text style={styles.subtitle}>현재 대기열 정보를 확인하세요</Text>
      </View>

      {queues.map((queue) => {
        const timeSlotData = timeSlots[queue.id];
        return (
          <View key={queue.id} style={styles.queueCard}>
            {/* 현재 상태 */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>현재 상태</Text>
              <Text style={styles.statusText}>대기 중</Text>
            </View>

            {/* 대기열 정보 */}
            <View style={styles.queueInfo}>
              {timeSlotData && (
                <Text style={styles.queueDetail}>시간대: {timeSlotData.startTime} - {timeSlotData.endTime}</Text>
              )}
              <Text style={styles.queueDetail}>
                순번: <Text style={styles.queueNumber}>
                  {queue.isCompanionService && queue.originalQueueNumber !== queue.queueNumber
                    ? `${queue.originalQueueNumber} → ${queue.queueNumber}번`
                    : `${queue.queueNumber}번`
                  }
                </Text>
              </Text>
              
            </View>

            {/* 입장 현황 */}
            <View style={styles.entryStatus}>
              <Text style={styles.entryStatusLabel}>입장 현황</Text>
              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>
              <Text style={styles.progressText}>20%</Text>
            </View>

            {/* 이벤트 정보 */}
            <View style={styles.eventInfo}>
              <Text style={styles.eventInfoLabel}>이벤트 정보</Text>
              {events[queue.id] && (
                <>
                  <Text style={styles.eventDetail}>{events[queue.id].name}</Text>
                  <Text style={styles.eventDetail}>{formatDate(events[queue.id].date)}</Text>
                  <Text style={styles.eventDetail}>{events[queue.id].location}</Text>
                </>
              )}
            </View>

            {/* 등록 정보 */}
            <View style={styles.registrationInfo}>
              <Text style={styles.registrationLabel}>등록 정보</Text>
              <Text style={styles.registrationDetail}>등록 시간: {formatDate(queue.createdAt)}</Text>
            </View>

            <Text style={styles.statusDescription}>
              대기 중인 상태입니다. 필요시 취소할 수 있습니다.
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelQueue(queue.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cancelButtonContent}>
                <Text style={styles.cancelButtonIcon}>✕</Text>
                <Text style={styles.cancelButtonText}>대기열 취소</Text>
              </View>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* 뒤로가기 버튼 */}
      <View style={styles.backButtonContainer}>
        <Button
          title="뒤로가기"
          onPress={() => {
            // 네비게이션 스택에서 뒤로가기
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
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
    paddingBottom: 100, // ProfileScreen과 동일한 패딩
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    marginTop: 10,
  },
  queueCard: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  queueNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  waitTime: {
    fontSize: 16,
    color: '#8E8E93',
  },
  progressContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  progressLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    width: '20%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'right',
  },
  eventSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
  },
  timeSlotSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  timeSlotTime: {
    fontSize: 16,
    color: '#000000',
  },
  registrationSection: {
    marginBottom: 20,
  },
  registrationTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionSection: {
    alignItems: 'center',
  },
  actionInfo: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 10,
    alignSelf: 'center',
    minWidth: 140,
  },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20, // 하단 패딩을 원래대로 되돌림
  },
  backButton: {
    borderColor: '#E5E5EA',
    borderWidth: 1,
    minWidth: 120,
  },
  statusDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 15,
  },
  queueInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  queueDetail: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 5,
  },
  entryStatus: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  entryStatusLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
  },
  eventInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  eventInfoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  eventDetail: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  registrationInfo: {
    marginBottom: 20,
  },
  registrationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  registrationDetail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  cancelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  cancelButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
