import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Button } from '../components/common/Button';
import { getCompanionRequestsByQueue, acceptCompanionRequest } from '../services/companionService';
import { QueueService } from '../services/queueService';
import { useAuth } from '../contexts/AuthContext';
import { CompanionRequestData, QueueData } from '../types/firestore';
import { logError } from '../utils/errorUtils';

type CompanionMatchingScreenRouteProp = RouteProp<RootStackParamList, 'CompanionMatching'>;
type CompanionMatchingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CompanionMatching'>;

const CompanionMatchingScreen: React.FC = () => {
  const navigation = useNavigation<CompanionMatchingScreenNavigationProp>();
  const route = useRoute<CompanionMatchingScreenRouteProp>();
  const { user } = useAuth();
  
  const { queueId } = route.params;
  
  const [requests, setRequests] = useState<CompanionRequestData[]>([]);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [queueId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('CompanionMatchingScreen: 데이터 로드 시작, queueId:', queueId);
      
      // 대기열 정보 로드
      const queueData = await QueueService.getQueueById(queueId);
      if (queueData) {
        setQueue(queueData);
        console.log('CompanionMatchingScreen: 대기열 정보 로드 성공:', queueData.queueNumber);
      } else {
        console.log('CompanionMatchingScreen: 대기열 정보를 찾을 수 없음');
      }
      
      // 동행자 요청 목록 로드
      const requestsData = await getCompanionRequestsByQueue(queueId);
      setRequests(requestsData);
      console.log('CompanionMatchingScreen: 동행자 요청 목록 로드 완료:', requestsData.length);
    } catch (error) {
      console.error('CompanionMatchingScreen: 데이터 로드 실패:', error);
      logError('동행자 매칭 데이터 로드 실패:', error);
      Alert.alert('오류', '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAcceptRequest = async (request: CompanionRequestData) => {
    if (!user || !queue) {
      console.log('CompanionMatchingScreen: 사용자 또는 대기열 정보 없음');
      return;
    }

    console.log('CompanionMatchingScreen: 동행자 요청 수락 시작:', {
      requestId: request.id,
      userId: user.uid,
      queueId,
      queueNumber: queue.queueNumber
    });

    Alert.alert(
      '동행자 요청 수락',
      `${request.originalQueueNumber}번 사용자의 동행자 요청을 수락하시겠습니까?\n\n제안 금액: ${request.offeredPrice.toLocaleString()}원`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '수락',
          onPress: async () => {
            try {
              setAcceptingRequestId(request.id);
              
              console.log('CompanionMatchingScreen: acceptCompanionRequest 호출');
              await acceptCompanionRequest(
                request.id,
                user.uid,
                queueId,
                queue.queueNumber
              );
              
              console.log('CompanionMatchingScreen: 동행자 요청 수락 성공');
              Alert.alert(
                '수락 완료',
                '동행자 요청을 수락했습니다. 대기열 번호가 연동되었습니다.',
                [
                  {
                    text: '확인',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error('CompanionMatchingScreen: 동행자 요청 수락 실패:', error);
              logError('동행자 요청 수락 실패:', error);
              Alert.alert('오류', '요청 수락에 실패했습니다.');
            } finally {
              setAcceptingRequestId(null);
            }
          },
        },
      ]
    );
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return '방금 전';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}분 전`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}시간 전`;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>동행자 요청 목록</Text>
        <Text style={styles.subtitle}>수락 가능한 동행자 요청을 확인하세요</Text>
      </View>

      {/* 현재 대기열 정보 */}
      {queue && (
        <View style={styles.queueInfoSection}>
          <Text style={styles.sectionTitle}>현재 대기열 정보</Text>
          <View style={styles.queueInfo}>
            <Text style={styles.queueInfoLabel}>대기열 번호</Text>
            <Text style={styles.queueInfoValue}>{queue.queueNumber}번</Text>
          </View>
          {queue.estimatedWaitTime && (
            <View style={styles.queueInfo}>
              <Text style={styles.queueInfoLabel}>예상 대기 시간</Text>
              <Text style={styles.queueInfoValue}>
                {Math.floor(queue.estimatedWaitTime / 60)}시간 {queue.estimatedWaitTime % 60}분
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 동행자 요청 목록 */}
      <View style={styles.requestsSection}>
        <Text style={styles.sectionTitle}>동행자 요청 목록</Text>
        
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>현재 수락 가능한 동행자 요청이 없습니다.</Text>
            <Text style={styles.emptySubtext}>잠시 후 다시 확인해보세요.</Text>
          </View>
        ) : (
          requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestNumber}>{request.originalQueueNumber}번</Text>
                <Text style={styles.requestTime}>{formatTime(request.createdAt)}</Text>
              </View>
              
              <View style={styles.requestDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>제안 금액</Text>
                  <Text style={styles.detailValue}>{formatPrice(request.offeredPrice)}원</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>검색 범위</Text>
                  <Text style={styles.detailValue}>±{request.searchRange}칸</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  acceptingRequestId === request.id && styles.acceptButtonDisabled
                ]}
                onPress={() => handleAcceptRequest(request)}
                disabled={acceptingRequestId === request.id}
                activeOpacity={0.8}
              >
                <View style={styles.acceptButtonContent}>
                  {acceptingRequestId === request.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptButtonIcon}>✅</Text>
                  )}
                  <Text style={styles.acceptButtonText}>
                    {acceptingRequestId === request.id ? '수락 중...' : '수락하기'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* 안내 정보 */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>수락 시 안내</Text>
        <Text style={styles.infoText}>
          • 동행자와 같은 대기열 번호로 연동됩니다{'\n'}
          • 동행자는 "(동행자)" 표시로 구분됩니다{'\n'}
          • 수락 후에는 취소할 수 없습니다{'\n'}
          • 매칭 완료 시 제안 금액이 지급됩니다
        </Text>
      </View>

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
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  queueInfoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  queueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  queueInfoLabel: {
    fontSize: 16,
    color: '#666',
  },
  queueInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  requestsSection: {
    marginBottom: 20,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  requestNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  requestTime: {
    fontSize: 14,
    color: '#666',
  },
  requestDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptButtonDisabled: {
    backgroundColor: '#999',
    shadowOpacity: 0.1,
  },
  acceptButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  backButtonContainer: {
    paddingTop: 20,
  },
  backButton: {
    borderColor: '#666',
    borderWidth: 1,
  },
});

export default CompanionMatchingScreen;
