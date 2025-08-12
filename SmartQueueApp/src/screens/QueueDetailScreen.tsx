import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { useAuth } from '../contexts/AuthContext';
import { QueueService } from '../services/queueService';
import { EventService } from '../services/eventService';
import { QueueData, EventData, TimeSlotData } from '../types/firestore';
import { formatDate } from '../utils/firestoreUtils';
import { logError, getUserFriendlyErrorMessage } from '../utils/errorUtils';

type QueueDetailRouteProp = RouteProp<RootStackParamList, 'QueueDetail'>;
type QueueDetailNavigationProp = StackNavigationProp<RootStackParamList, 'QueueDetail'>;

export const QueueDetailScreen: React.FC = () => {
  const route = useRoute<QueueDetailRouteProp>();
  const navigation = useNavigation<QueueDetailNavigationProp>();
  const { user } = useAuth();
  const { queueId } = route.params;
  
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadQueueDetails();
  }, [queueId]);

  const loadQueueDetails = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 대기열 정보 로드
      const queueData = await QueueService.getQueueById(queueId);
      
      if (!queueData) {
        Alert.alert('오류', '대기열을 찾을 수 없습니다.');
        return;
      }
      
      // 사용자 권한 확인
      if (queueData.userId !== user.uid) {
        Alert.alert('오류', '이 대기열에 접근할 권한이 없습니다.');
        return;
      }
      
      setQueue(queueData);

      // 이벤트 정보 로드
      const eventData = await EventService.getEventById(queueData.eventId);
      setEventData(eventData);

      // 타임슬롯 정보 로드
      const timeSlotData = await EventService.getTimeSlotById(queueData.timeSlotId);
      setTimeSlotData(timeSlotData);
    } catch (error) {
      logError('QueueDetailScreen.loadQueueDetails', error);
      Alert.alert('오류', '대기열 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelQueue = async () => {
    if (!queue || !user) {
      console.error('QueueDetailScreen: 대기열 또는 사용자 정보가 없음');
      Alert.alert('오류', '대기열 정보를 찾을 수 없습니다.');
      return;
    }

    // Alert 다이얼로그 없이 바로 취소 시도
    try {
      console.log('QueueDetailScreen: 대기열 취소 시작 - queueId:', queueId);
      setCancelling(true);
      
      await QueueService.cancelQueue(queueId, user.uid);
      console.log('QueueDetailScreen: 대기열 취소 성공 - 뒤로가기 실행');
       
      // 단순히 뒤로가기 (Alert 없이)
      navigation.goBack();
    } catch (error) {
      console.error('QueueDetailScreen: 대기열 취소 실패:', error);
      logError('QueueDetailScreen.handleCancelQueue', error);
      
      let errorMessage = '대기열 취소에 실패했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert('취소 실패', errorMessage);
    } finally {
      setCancelling(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#FF9500';
      case 'called':
        return '#007AFF';
      case 'entered':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
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
        return '#FF9500';
      case 'called':
        return '#007AFF';
      case 'entered':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  if (loading) {
    return <Loader text="대기열 정보를 불러오는 중..." fullScreen />;
  }

  if (!queue) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>대기열을 찾을 수 없습니다</Text>
          <Button
            title="뒤로가기"
            onPress={() => navigation.goBack()}
            variant="outline"
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
    >
      <View style={styles.header}>
        <Text style={styles.title}>대기열 상세 정보</Text>
        <Text style={styles.subtitle}>현재 대기열 상태를 확인하세요</Text>
      </View>
      
      {/* 상태 섹션 */}
      <View style={styles.statusSection}>
        <Text style={styles.statusLabel}>현재 상태</Text>
        <Text style={styles.statusText}>대기 중</Text>
      </View>

      {/* 대기열 정보 섹션 */}
      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>대기열 정보</Text>
        <Text style={styles.infoDetail}>순번: <Text style={styles.queueNumber}>{queue.queueNumber}번</Text></Text>
        {queue.estimatedWaitTime && (
          <Text style={styles.infoDetail}>예상 대기 시간: {Math.floor(queue.estimatedWaitTime / 60)}시간 {queue.estimatedWaitTime % 60}분</Text>
        )}
      </View>

      {/* 입장 현황 섹션 */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>입장 현황</Text>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.progressText}>20%</Text>
      </View>

      {/* 이벤트 정보 섹션 */}
      <View style={styles.eventSection}>
        <Text style={styles.eventLabel}>이벤트 정보</Text>
        {eventData && (
          <>
            <Text style={styles.eventDetail}>{eventData.name}</Text>
            <Text style={styles.eventDetail}>{formatDate(eventData.date)}</Text>
            <Text style={styles.eventDetail}>{eventData.location}</Text>
          </>
        )}
      </View>

      {/* 등록 정보 섹션 */}
      <View style={styles.registrationSection}>
        <Text style={styles.registrationLabel}>등록 정보</Text>
        <Text style={styles.registrationDetail}>등록 시간: {formatDate(queue.createdAt)}</Text>
      </View>

      {/* 액션 섹션 */}
      <View style={styles.actionSection}>
        <Text style={styles.actionDescription}>
          대기 중인 상태입니다. 필요시 취소할 수 있습니다.
        </Text>
        
        {/* 동행자 서비스 요청 버튼 */}
        <TouchableOpacity
          style={styles.companionButton}
          onPress={() => navigation.navigate('CompanionRequest', { queueId })}
          activeOpacity={0.8}
        >
          <View style={styles.companionButtonContent}>
            <Text style={styles.companionButtonIcon}>👥</Text>
            <Text style={styles.companionButtonText}>동행자 서비스 요청</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelQueue}
          activeOpacity={0.8}
        >
          <View style={styles.cancelButtonContent}>
            <Text style={styles.cancelButtonIcon}>✕</Text>
            <Text style={styles.cancelButtonText}>대기열 취소</Text>
          </View>
        </TouchableOpacity>
      </View>

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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 20,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9500',
  },
  infoSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  infoDetail: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  queueNumber: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
    width: '20%',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
  },
  eventSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  eventDetail: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  registrationSection: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  registrationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  registrationDetail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  actionSection: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  companionButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 10,
  },
  companionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionButtonIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#FFFFFF',
  },
  companionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 10,
  },
  cancelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
