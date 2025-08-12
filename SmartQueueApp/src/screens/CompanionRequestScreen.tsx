import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { createCompanionRequest, cancelCompanionRequest } from '../services/companionService';
import { QueueService } from '../services/queueService';
import { useAuth } from '../contexts/AuthContext';
import { QueueData } from '../types/firestore';
import { logError } from '../utils/errorUtils';

type CompanionRequestScreenRouteProp = RouteProp<RootStackParamList, 'CompanionRequest'>;
type CompanionRequestScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CompanionRequest'>;

const CompanionRequestScreen: React.FC = () => {
  const navigation = useNavigation<CompanionRequestScreenNavigationProp>();
  const route = useRoute<CompanionRequestScreenRouteProp>();
  const { user } = useAuth();
  
  const { queueId } = route.params;
  
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [offeredPrice, setOfferedPrice] = useState('10000');
  const [searchRange, setSearchRange] = useState(5);
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isRequestActive, setIsRequestActive] = useState(false);

  // 대기열 정보 로드
  useEffect(() => {
    loadQueueInfo();
  }, [queueId]);

  const loadQueueInfo = async () => {
    try {
      setLoading(true);
      const queueData = await QueueService.getQueueById(queueId);
      if (queueData) {
        setQueue(queueData);
      }
    } catch (error) {
      logError('대기열 정보 로드 실패:', error);
      Alert.alert('오류', '대기열 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!user || !queue) {
      console.log('CompanionRequestScreen: 사용자 또는 대기열 정보 없음');
      return;
    }

    const price = parseInt(offeredPrice);
    if (isNaN(price) || price < 10000) {
      Alert.alert('오류', '최소 금액은 10,000원입니다.');
      return;
    }

    try {
      setLoading(true);
      console.log('CompanionRequestScreen: 동행자 요청 생성 시작:', {
        userId: user.uid,
        queueId,
        queueNumber: queue.queueNumber,
        price
      });
      
      const newRequestId = await createCompanionRequest(
        user.uid,
        queueId,
        queue.queueNumber,
        price
      );
      
      console.log('CompanionRequestScreen: 동행자 요청 생성 성공:', newRequestId);
      setRequestId(newRequestId);
      setIsRequestActive(true);
      
      Alert.alert(
        '요청 완료',
        '동행자 요청이 생성되었습니다. 매칭을 기다려주세요.',
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('CompanionRequestScreen: 동행자 요청 생성 실패:', error);
      logError('동행자 요청 생성 실패:', error);
      Alert.alert('오류', '동행자 요청을 생성할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;

    Alert.alert(
      '요청 취소',
      '동행자 요청을 취소하시겠습니까?',
      [
        {
          text: '아니오',
          style: 'cancel',
        },
        {
          text: '예',
          onPress: async () => {
            try {
              setLoading(true);
              await cancelCompanionRequest(requestId);
              setIsRequestActive(false);
              setRequestId(null);
              Alert.alert('취소 완료', '동행자 요청이 취소되었습니다.');
            } catch (error) {
              logError('동행자 요청 취소 실패:', error);
              Alert.alert('오류', '요청 취소에 실패했습니다.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePriceChange = (text: string) => {
    const price = parseInt(text.replace(/[^0-9]/g, ''));
    if (!isNaN(price) && price >= 10000) {
      setOfferedPrice(price.toString());
    } else if (text === '') {
      setOfferedPrice('');
    }
  };

  const formatPrice = (price: string) => {
    const num = parseInt(price);
    return isNaN(num) ? '' : num.toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  if (!queue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>대기열 정보를 찾을 수 없습니다.</Text>
        <Button title="뒤로가기" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>동행자 서비스 요청</Text>
        <Text style={styles.subtitle}>대기 시간 동안 자유롭게 활동하세요</Text>
      </View>

      {/* 현재 대기열 정보 */}
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

      {/* 제안 금액 설정 */}
      <View style={styles.priceSection}>
        <Text style={styles.sectionTitle}>제안 금액</Text>
        <Text style={styles.priceDescription}>
          동행자에게 지급할 금액을 설정하세요 (최소 10,000원)
        </Text>
        <View style={styles.priceInputContainer}>
          <Input
            value={formatPrice(offeredPrice)}
            onChangeText={handlePriceChange}
            placeholder="금액을 입력하세요"
            keyboardType="numeric"
            style={styles.priceInput}
          />
          <Text style={styles.priceUnit}>원</Text>
        </View>
      </View>

      {/* 검색 범위 정보 */}
      <View style={styles.rangeSection}>
        <Text style={styles.sectionTitle}>검색 범위</Text>
        <Text style={styles.rangeDescription}>
          현재 ±{searchRange}칸 범위에서 동행자를 찾고 있습니다.
        </Text>
        <Text style={styles.rangeNote}>
          • 1분 후 ±10칸으로 확장됩니다{'\n'}
          • 2분 후 ±15칸으로 확장됩니다{'\n'}
          • 최대 ±50칸까지 확장됩니다
        </Text>
      </View>

      {/* 서비스 설명 */}
      <View style={styles.serviceInfoSection}>
        <Text style={styles.sectionTitle}>서비스 안내</Text>
        <Text style={styles.serviceDescription}>
          • 동행자가 대기열을 대신 서줍니다{'\n'}
          • 매칭되면 동행자와 같은 번호로 연동됩니다{'\n'}
          • 동행자는 "(동행자)" 표시로 구분됩니다{'\n'}
          • 매칭 후에는 요청을 취소할 수 없습니다
        </Text>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actionSection}>
        {!isRequestActive ? (
          <Button
            title="동행자 요청하기"
            onPress={handleCreateRequest}
            style={styles.requestButton}
            disabled={loading}
          />
        ) : (
          <Button
            title="요청 취소하기"
            onPress={handleCancelRequest}
            style={styles.cancelButton}
            variant="outline"
            disabled={loading}
          />
        )}
        
        <Button
          title="뒤로가기"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          variant="outline"
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
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
  priceSection: {
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
  priceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    flex: 1,
    marginRight: 10,
  },
  priceUnit: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  rangeSection: {
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
  rangeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  rangeNote: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
  serviceInfoSection: {
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
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionSection: {
    gap: 15,
  },
  requestButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  backButton: {
    borderColor: '#666',
    borderWidth: 1,
  },
});

export default CompanionRequestScreen;
