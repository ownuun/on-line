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
import { createCompanionRequest, cancelCompanionRequest, updateCompanionRequestPrice } from '../services/companionService';
import { QueueService } from '../services/queueService';
import { useAuth } from '../contexts/AuthContext';
import { QueueData } from '../types/firestore';
import { logError } from '../utils/errorUtils';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  const [isCancelled, setIsCancelled] = useState(false);
  const [isWithdrawnByCompanion, setIsWithdrawnByCompanion] = useState(false);
  const [isCompanion, setIsCompanion] = useState(false);
  const [companionInfo, setCompanionInfo] = useState<any>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // 대기열 정보 로드
  useEffect(() => {
    loadQueueInfo();
  }, [queueId]);

     // 기존 동행자 요청 확인
   useEffect(() => {
     if (user?.uid && queue) {
       checkExistingRequest();
       checkCompanionStatus();
     }
   }, [user?.uid, queue]);

  // 동행자 상태 확인
  const checkCompanionStatus = async () => {
    if (!user?.uid || !queue) return;

    try {
      const q = query(
        collection(db, 'companions'),
        where('userId', '==', user.uid),
        where('eventId', '==', queue.eventId),
        where('status', 'in', ['waiting', 'active'])
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const companionDoc = querySnapshot.docs[0];
        const companionData = companionDoc.data();
        setIsCompanion(true);
        setCompanionInfo({
          ...companionData,
          id: companionDoc.id,
          createdAt: companionData.createdAt?.toDate(),
        });
      } else {
        setIsCompanion(false);
        setCompanionInfo(null);
      }
    } catch (error) {
      console.error('CompanionRequestScreen: 동행자 상태 확인 실패:', error);
    }
  };

  const loadQueueInfo = async () => {
    try {
      setLoading(true);
      const queueData = await QueueService.getQueueById(queueId);
      
      if (queueData) {
        setQueue(queueData);
      } else {
        console.log('CompanionRequestScreen: 대기열 정보를 찾을 수 없음');
      }
    } catch (error) {
      console.error('CompanionRequestScreen: 대기열 정보 로드 실패:', error);
      logError('대기열 정보 로드 실패:', error);
      Alert.alert('오류', '대기열 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

     const checkExistingRequest = async () => {
    if (!user?.uid || !queue) return;

    try {
      // 해당 대기열의 기존 동행자 요청 조회
      const requestsQuery = query(
        collection(db, 'companionRequests'),
        where('userId', '==', user.uid),
        where('queueId', '==', queue.id)
      );
      
      const requestsSnapshot = await getDocs(requestsQuery);
      
      if (!requestsSnapshot.empty) {
        // 기존 요청이 있는 경우
        const existingRequest = requestsSnapshot.docs[0];
        const requestData = existingRequest.data();
        
        // 요청 상태에 따라 UI 업데이트
        if (requestData.status === 'pending') {
          // 대기 중인 요청이 있으면 활성 상태로 설정
          setRequestId(existingRequest.id);
          setIsRequestActive(true);
          setIsCancelled(false);
          setIsWithdrawnByCompanion(false);
          setOfferedPrice(requestData.offeredPrice?.toString() || '10000');
        } else if (requestData.status === 'matched') {
          // 매칭된 요청이 있으면 요청 불가능 상태로 설정
          setRequestId(existingRequest.id);
          setIsRequestActive(true);
          setIsCancelled(false);
          setIsWithdrawnByCompanion(false);
          setOfferedPrice(requestData.offeredPrice?.toString() || '10000');
        } else if (requestData.status === 'cancelled') {
          // 본인이 취소한 요청이 있으면 재요청 불가능 상태로 설정
          setRequestId(existingRequest.id);
          setIsRequestActive(true);
          setIsCancelled(true);
          setIsWithdrawnByCompanion(false);
          setOfferedPrice(requestData.offeredPrice?.toString() || '10000');
        } else if (requestData.status === 'withdrawn_by_companion') {
          // 동행자가 철회한 요청이 있으면 재요청 가능 상태로 설정
          setRequestId(null);
          setIsRequestActive(false);
          setIsCancelled(false);
          setIsWithdrawnByCompanion(true);
          setOfferedPrice(requestData.offeredPrice?.toString() || '10000');
        }
      } else {
        // 기존 요청이 없는 경우
        setRequestId(null);
        setIsRequestActive(false);
        setIsCancelled(false);
        setIsWithdrawnByCompanion(false);
      }
    } catch (error) {
      console.error('CompanionRequestScreen: 기존 요청 확인 실패:', error);
      logError('기존 동행자 요청 확인 실패:', error);
    }
  };

  const handleCreateRequest = async () => {
    if (!user?.uid || !queue) {
      Alert.alert('오류', '사용자 정보 또는 대기열 정보가 없습니다.');
      return;
    }

    if (isCompanion) {
      Alert.alert('요청 불가', '동행자 상태에서는 동행자 요청을 할 수 없습니다.');
      return;
    }

    const price = parseInt(offeredPrice);
    if (isNaN(price) || price < 10000) {
      Alert.alert('오류', '최소 10,000원 이상의 금액을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      const newRequestId = await createCompanionRequest(
        user.uid,
        queue.id, // route.params.queueId 대신 queue.id 사용
        queue.queueNumber,
        price
      );
      
      setRequestId(newRequestId);
      setIsRequestActive(true);
      setIsCancelled(false);
      setIsWithdrawnByCompanion(false);
      
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

    try {
      setLoading(true);
      await cancelCompanionRequest(requestId);
      
      // 취소 상태로 설정
      setIsCancelled(true);
      setIsWithdrawnByCompanion(false);
    } catch (error) {
      console.error('CompanionRequestScreen: 동행자 요청 취소 실패:', error);
      logError('동행자 요청 취소 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!requestId) return;

    const price = parseInt(offeredPrice);
    if (isNaN(price) || price < 10000) {
      Alert.alert('오류', '최소 10,000원 이상의 금액을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      await updateCompanionRequestPrice(requestId, price);
      
      // 수정 모드 종료
      setIsEditingPrice(false);
      
      Alert.alert('성공', '금액이 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('CompanionRequestScreen: 금액 수정 실패:', error);
      logError('동행자 요청 금액 수정 실패:', error);
      Alert.alert('오류', '금액 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrice = () => {
    setIsEditingPrice(true);
  };

  const handleCancelEditPrice = () => {
    // 원래 금액으로 되돌리기
    if (requestId) {
      checkExistingRequest();
    }
    setIsEditingPrice(false);
  };

  const handlePriceChange = (text: string) => {
    // 콤마 제거 후 숫자만 추출
    const numericValue = text.replace(/[^0-9]/g, '');
    
    if (numericValue === '') {
      setOfferedPrice('');
      return;
    }
    
    const price = parseInt(numericValue);
    
    // 최소 금액 검증
    if (price >= 10000) {
      setOfferedPrice(price.toString());
    } else if (price > 0) {
      // 최소 금액보다 작지만 0보다 큰 경우, 입력은 허용하되 경고 표시
      setOfferedPrice(price.toString());
    }
  };

  const formatPrice = (price: string) => {
    if (!price || price === '') return '';
    
    const num = parseInt(price);
    if (isNaN(num) || num === 0) return '';
    
    return num.toLocaleString();
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
            disabled={!isEditingPrice && isRequestActive}
          />
          <Text style={styles.priceUnit}>원</Text>
        </View>
        {offeredPrice && parseInt(offeredPrice) > 0 && parseInt(offeredPrice) < 10000 && (
          <Text style={styles.priceWarning}>
            최소 10,000원 이상 입력해주세요.
          </Text>
        )}
        
        {/* 금액 수정 버튼 (기존 요청이 있을 때만 표시) */}
        {isRequestActive && !isCancelled && (
          <View style={styles.priceEditContainer}>
            {!isEditingPrice ? (
              <Button
                title="금액 수정"
                onPress={handleEditPrice}
                style={styles.editPriceButton}
                variant="outline"
                textStyle={{ color: '#007AFF' }}
                disabled={loading}
              />
            ) : (
              <View style={styles.editPriceActions}>
                <Button
                  title="수정 완료"
                  onPress={handleUpdatePrice}
                  style={styles.updatePriceButton}
                  disabled={loading}
                />
                <Button
                  title="취소"
                  onPress={handleCancelEditPrice}
                  style={styles.cancelEditButton}
                  variant="outline"
                  textStyle={{ color: '#666' }}
                  disabled={loading}
                />
              </View>
            )}
          </View>
        )}
      </View>

      {/* 검색 범위 정보 */}
      <View style={styles.rangeSection}>
        <Text style={styles.sectionTitle}>검색 범위</Text>
        <Text style={styles.rangeDescription}>
          현재 ±{searchRange}칸 범위에서 동행자를 찾고 있습니다.
        </Text>
        <View>
          <Text style={styles.rangeNote}>• 1분 후 ±10칸으로 확장됩니다</Text>
          <Text style={styles.rangeNote}>• 2분 후 ±15칸으로 확장됩니다</Text>
          <Text style={styles.rangeNote}>• 최대 ±50칸까지 확장됩니다</Text>
        </View>
      </View>

      {/* 서비스 설명 */}
      <View style={styles.serviceInfoSection}>
        <Text style={styles.sectionTitle}>서비스 안내</Text>
        <View>
          <Text style={styles.serviceDescription}>• 동행자가 대기열을 대신 서줍니다</Text>
          <Text style={styles.serviceDescription}>• 매칭되면 동행자와 같은 번호로 연동됩니다</Text>
          <Text style={styles.serviceDescription}>• 동행자는 "(동행자)" 표시로 구분됩니다</Text>
          <Text style={styles.serviceDescription}>• 매칭 후에는 요청을 취소할 수 없습니다</Text>
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actionSection}>
        {isCompanion ? (
          // 동행자 상태 UI
          <View style={styles.companionStatusSection}>
            <Text style={styles.companionStatusTitle}>동행자 상태</Text>
            <Text style={styles.companionStatusText}>
              이미 다른 사용자의 동행자로 등록되어 있습니다.
            </Text>
            <Text style={styles.companionStatusNote}>
              • 동행자 상태에서는 동행자 요청을 할 수 없습니다{'\n'}
              • 다른 이벤트에서는 여전히 동행자 요청이 가능합니다
            </Text>
          </View>
        ) : !isRequestActive ? (
          <Button
            title="동행자 요청하기"
            onPress={handleCreateRequest}
            style={styles.requestButton}
            disabled={loading}
          />
        ) : isCancelled ? (
          // 본인이 취소한 상태 UI
          <View style={styles.cancelledStatusSection}>
            <Text style={styles.cancelledStatusTitle}>동행자 요청 취소됨</Text>
            <Text style={styles.cancelledStatusText}>
              동행자 요청을 취소했습니다.
            </Text>
            <Text style={styles.cancelledStatusNote}>
              • 취소 후에는 재요청이 불가능합니다{'\n'}
              • 새로운 동행자 요청을 하려면 다른 대기열을 이용하세요
            </Text>
          </View>
        ) : isWithdrawnByCompanion ? (
          // 동행자가 철회한 상태 UI
          <View style={styles.withdrawnStatusSection}>
            <Text style={styles.withdrawnStatusTitle}>동행자가 철회함</Text>
            <Text style={styles.withdrawnStatusText}>
              동행자가 서비스를 철회했습니다.
            </Text>
            <Text style={styles.withdrawnStatusNote}>
              • 동행자 철회로 인해 재요청이 가능합니다{'\n'}
              • 아래 버튼을 눌러 새로운 동행자 요청을 할 수 있습니다
            </Text>
            <Button
              title="다시 동행자 요청하기"
              onPress={handleCreateRequest}
              style={styles.requestButton}
              disabled={loading}
            />
          </View>
        ) : (
          // 활성 요청 상태 UI
          <>
            <View style={styles.requestStatusSection}>
              <Text style={styles.requestStatusTitle}>동행자 요청 상태</Text>
              <Text style={styles.requestStatusText}>
                {requestId ? '동행자 요청이 활성화되어 있습니다.' : '동행자 요청이 처리 중입니다.'}
              </Text>
              <Text style={styles.requestStatusNote}>
                • 요청 취소 후에는 재요청이 불가능합니다{'\n'}
                • 매칭이 완료되면 요청이 자동으로 비활성화됩니다
              </Text>
            </View>
            
            <Button
              title="요청 취소하기"
              onPress={handleCancelRequest}
              style={styles.cancelButton}
              variant="outline"
              disabled={loading}
            />
          </>
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
  priceWarning: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 10,
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
  requestStatusSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  requestStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  requestStatusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
     requestStatusNote: {
     fontSize: 12,
     color: '#FF9500',
     lineHeight: 16,
   },
   cancelledStatusSection: {
     backgroundColor: '#FFE5E5',
     borderRadius: 12,
     padding: 20,
     marginBottom: 15,
     borderLeftWidth: 4,
     borderLeftColor: '#FF3B30',
   },
   cancelledStatusTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#1C1C1E',
     marginBottom: 8,
   },
   cancelledStatusText: {
     fontSize: 14,
     color: '#666',
     marginBottom: 10,
   },
   cancelledStatusNote: {
     fontSize: 12,
     color: '#FF3B30',
     lineHeight: 16,
   },
   companionStatusSection: {
     backgroundColor: '#E0F2F7',
     borderRadius: 12,
     padding: 20,
     marginBottom: 15,
     borderLeftWidth: 4,
     borderLeftColor: '#007AFF',
   },
   companionStatusTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#1C1C1E',
     marginBottom: 8,
   },
   companionStatusText: {
     fontSize: 14,
     color: '#666',
     marginBottom: 10,
   },
   companionStatusNote: {
     fontSize: 12,
     color: '#007AFF',
     lineHeight: 16,
   },
   withdrawnStatusSection: {
     backgroundColor: '#E8F5E8',
     borderRadius: 12,
     padding: 20,
     marginBottom: 15,
     borderLeftWidth: 4,
     borderLeftColor: '#34C759',
   },
   withdrawnStatusTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#1C1C1E',
     marginBottom: 8,
   },
   withdrawnStatusText: {
     fontSize: 14,
     color: '#666',
     marginBottom: 10,
   },
   withdrawnStatusNote: {
     fontSize: 12,
     color: '#34C759',
     lineHeight: 16,
     marginBottom: 15,
   },
   priceEditContainer: {
     marginTop: 15,
   },
   editPriceButton: {
     // outline 버튼이므로 배경색 제거하고 테두리 색상만 설정
   },
   editPriceActions: {
     flexDirection: 'row',
     gap: 10,
   },
   updatePriceButton: {
     flex: 1,
     backgroundColor: '#34C759',
   },
   cancelEditButton: {
     flex: 1,
     borderColor: '#666',
     borderWidth: 1,
     // outline 버튼의 글씨 색상을 명확하게 설정
   },
 });

export default CompanionRequestScreen;
