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
import { QueueService } from '../services/queueService';
import { withdrawCompanionService } from '../services/companionService';
import { useAuth } from '../contexts/AuthContext';
import { CompanionRequestData, QueueData } from '../types/firestore';
import { logError } from '../utils/errorUtils';
import { 
  collection, 
  doc, 
  setDoc,
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

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
  const [isCompanion, setIsCompanion] = useState(false);
  const [companionInfo, setCompanionInfo] = useState<any>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [requesterInfo, setRequesterInfo] = useState<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestingInfo, setRequestingInfo] = useState<any>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string>('');
  const [showWithdrawMessage, setShowWithdrawMessage] = useState(false);

  // 데이터 로드
  useEffect(() => {
    loadData();
    
    // 실시간 리스너 설정
    let unsubscribe: (() => void) | null = null;
    
    const setupRealtimeListener = async () => {
      try {
        // 대기열 정보를 먼저 가져와서 정확한 queueId 사용
        const queueData = await QueueService.getQueueById(queueId);
        if (!queueData?.id) {
          return;
        }
        
        // 실시간 리스너 설정
        const requestsQuery = query(
          collection(db, 'companionRequests'),
          where('eventId', '==', queueData.eventId),
          where('status', '==', 'pending')
        );
        
        unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
          const newRequests: CompanionRequestData[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            
            // 내 요청 제외
            if (data.userId === user?.uid) {
              return;
            }
            
            newRequests.push({
              ...data,
              id: doc.id,
              createdAt: data.createdAt.toDate(),
              matchedAt: data.matchedAt?.toDate(),
            } as CompanionRequestData);
          });
          
          // 동행자, 요청자, 요청 중 상태가 아닌 경우에만 요청 목록 표시
          if (!isCompanion && !isRequester && !isRequesting) {
            setRequests(newRequests);
          } else {
            setRequests([]);
          }
        }, (error) => {
          console.error('CompanionMatchingScreen: 실시간 리스너 오류:', error);
        });
        
      } catch (error) {
        console.error('CompanionMatchingScreen: 실시간 리스너 설정 실패:', error);
      }
    };
    
    setupRealtimeListener();
    
    // 컴포넌트 언마운트 시 리스너 정리
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [queueId, user?.uid, isCompanion, isRequester]);

  // 동행자 상태 확인
  const checkCompanionStatus = async (userId: string, queueId: string): Promise<any> => {
    try {
      const q = query(
        collection(db, 'companions'),
        where('userId', '==', userId),
        where('queueId', '==', queueId),
        where('status', 'in', ['waiting', 'active'])
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const companionDoc = querySnapshot.docs[0];
        const companionData = companionDoc.data();
        
        // 동행자 요청에서 linkedQueueNumber 가져오기
        let linkedQueueNumber = undefined;
        if (companionData.requestId) {
          const requestQuery = query(
            collection(db, 'companionRequests'),
            where('__name__', '==', companionData.requestId)
          );
          const requestSnapshot = await getDocs(requestQuery);
          if (!requestSnapshot.empty) {
            const requestData = requestSnapshot.docs[0].data();
            linkedQueueNumber = requestData.linkedQueueNumber;
          }
        }
        
        return {
          ...companionData,
          id: companionDoc.id,
          createdAt: companionData.createdAt?.toDate(),
          linkedQueueNumber,
        };
      }
      
      return null;
    } catch (error) {
      console.error('CompanionMatchingScreen: 동행자 상태 확인 실패:', error);
      throw error;
    }
  };

  // 요청자 상태 확인 (매칭된 요청이 있는지)
  const checkRequesterStatus = async (userId: string, queueId: string): Promise<any> => {
    try {
      const q = query(
        collection(db, 'companionRequests'),
        where('userId', '==', userId),
        where('queueId', '==', queueId),
        where('status', '==', 'matched')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const requestDoc = querySnapshot.docs[0];
        const requestData = requestDoc.data();
        return {
          ...requestData,
          id: requestDoc.id,
          createdAt: requestData.createdAt?.toDate(),
          matchedAt: requestData.matchedAt?.toDate(),
        };
      }
      
      return null;
    } catch (error) {
      console.error('CompanionMatchingScreen: 요청자 상태 확인 실패:', error);
      throw error;
    }
  };

  // 동행자 요청 목록 직접 조회
  const loadCompanionRequests = async (queueId: string): Promise<CompanionRequestData[]> => {
    try {
      if (!user?.uid) {
        return [];
      }
      
      // 대기열 정보에서 eventId 가져오기
      const queueData = await QueueService.getQueueById(queueId);
      if (!queueData?.eventId) {
        return [];
      }
      
      // eventId로 모든 pending 요청 조회
      const requestsQuery = query(
        collection(db, 'companionRequests'),
        where('eventId', '==', queueData.eventId),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(requestsQuery);
      
      const requests: CompanionRequestData[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // 내 요청 제외
        if (data.userId === user.uid) {
          return;
        }
        
        requests.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt.toDate(),
          matchedAt: data.matchedAt?.toDate(),
        } as CompanionRequestData);
      });
      
      return requests;
    } catch (error) {
      console.error('CompanionMatchingScreen: 동행자 요청 목록 직접 조회 실패:', error);
      throw error;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 대기열 정보 로드
      const queueData = await QueueService.getQueueById(queueId);
      
      if (queueData) {
        setQueue(queueData);
      } else {
        console.log('CompanionMatchingScreen: 대기열 정보를 찾을 수 없음');
      }
      
      // 실제 대기열 데이터의 ID를 한 번만 정의 (queueData.id 우선 사용)
      const actualQueueId = queueData?.id;
      
      if (!actualQueueId) {
        console.error('CompanionMatchingScreen: queueData.id가 없어서 작업을 중단합니다.');
        Alert.alert('오류', '대기열 정보를 불러올 수 없습니다.');
        return;
      }
      
      let isCompanionStatus = false;
      let isRequesterStatus = false;
      let isRequestingStatus = false;
      
      // 동행자 상태 확인
      if (user?.uid) {
        const companionData = await checkCompanionStatus(user.uid, actualQueueId);
        if (companionData) {
          setIsCompanion(true);
          setCompanionInfo(companionData);
          isCompanionStatus = true;
        } else {
          setIsCompanion(false);
          setCompanionInfo(null);
          isCompanionStatus = false;
        }
        
        // 요청자 상태 확인 (매칭된 요청이 있는지)
        const requesterData = await checkRequesterStatus(user.uid, actualQueueId);
        if (requesterData) {
          setIsRequester(true);
          setRequesterInfo(requesterData);
          isRequesterStatus = true;
        } else {
          setIsRequester(false);
          setRequesterInfo(null);
          isRequesterStatus = false;
        }

        // 사용자의 동행자 요청 상태 확인
        const requestingData = await checkUserRequestStatus(user.uid, actualQueueId);
        if (requestingData) {
          setIsRequesting(true);
          setRequestingInfo(requestingData);
          isRequestingStatus = true;
        } else {
          setIsRequesting(false);
          setRequestingInfo(null);
          isRequestingStatus = false;
        }
      }
      
      // 동행자 요청 목록은 실시간 리스너가 처리하므로 여기서는 로드하지 않음
      
    } catch (error) {
      console.error('CompanionMatchingScreen: 데이터 로드 실패:', error);
      Alert.alert('오류', '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사용자의 동행자 요청 상태 확인
  const checkUserRequestStatus = async (userId: string, queueId: string) => {
    try {
      const requestsQuery = query(
        collection(db, 'companionRequests'),
        where('userId', '==', userId),
        where('queueId', '==', queueId),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(requestsQuery);
      
      if (!querySnapshot.empty) {
        const requestDoc = querySnapshot.docs[0];
        const requestData = requestDoc.data();
        return {
          ...requestData,
          id: requestDoc.id,
          createdAt: requestData.createdAt.toDate(),
        };
      }
      
      return null;
    } catch (error) {
      console.error('CompanionMatchingScreen: 사용자 요청 상태 확인 실패:', error);
      return null;
    }
  };

  // 동행자 요청 수락 직접 구현
  const acceptCompanionRequestDirect = async (
    requestId: string,
    companionUserId: string,
    companionQueueId: string,
    companionOriginalNumber: number
  ): Promise<void> => {
    try {
      // Firebase 연결 상태 확인
      if (!db) {
        throw new Error('Firebase db 객체가 초기화되지 않았습니다.');
      }
      
      // 1. 동행자 요청 조회
      const requestRef = doc(db, 'companionRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('동행자 요청을 찾을 수 없습니다.');
      }
      
      const requestData = requestDoc.data();
      
      if (requestData.status !== 'pending') {
        throw new Error('이미 처리된 요청입니다.');
      }
      
             // 2. 동행자 생성
       const companionData = {
         userId: companionUserId,
         requestId,
         queueId: companionQueueId,
         originalQueueNumber: companionOriginalNumber,
         status: 'waiting',
         earnedAmount: requestData.offeredPrice,
         createdAt: serverTimestamp(),
       };
       
       const companionRef = doc(collection(db, 'companions'));
       await setDoc(companionRef, companionData);
      
             // 3. 요청 상태 업데이트
       const linkedNumber = Math.max(requestData.originalQueueNumber, companionOriginalNumber);
       
       const requestUpdateData = {
         status: 'matched',
         matchedAt: serverTimestamp(),
         companionId: companionRef.id,
         linkedQueueNumber: linkedNumber,
       };
       
       await updateDoc(requestRef, requestUpdateData);
      
       // 업데이트된 요청 문서 확인
       const updatedRequestDoc = await getDoc(requestRef);
       if (updatedRequestDoc.exists()) {
         // console.log('CompanionMatchingScreen: 업데이트된 요청 문서:', updatedRequestDoc.data());
       } else {
         console.error('CompanionMatchingScreen: 요청 문서를 찾을 수 없음!');
         throw new Error('요청 문서 업데이트 실패');
       }
      
             // 4. 순번 연동
      
      // 요청자 대기열 찾기
      const requesterQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', requestData.eventId),
        where('timeSlotId', '==', requestData.timeSlotId),
        where('userId', '==', requestData.userId)
      );
      const requesterSnapshot = await getDocs(requesterQuery);
      
      // 동행자 대기열 찾기
      const companionQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', requestData.eventId),
        where('timeSlotId', '==', requestData.timeSlotId),
        where('userId', '==', companionUserId)
      );
      const companionSnapshot = await getDocs(companionQuery);
      
      // 요청자 대기열 업데이트
      if (!requesterSnapshot.empty) {
        const requesterDoc = requesterSnapshot.docs[0];
        await updateDoc(requesterDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'requester',
          displayLabel: '',
          originalQueueNumber: requestData.originalQueueNumber,
        });
      }
      
      // 동행자 대기열 업데이트
      if (!companionSnapshot.empty) {
        const companionDoc = companionSnapshot.docs[0];
        await updateDoc(companionDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'companion',
          displayLabel: '(동행자)',
          originalQueueNumber: companionOriginalNumber,
        });
      }
      
    } catch (error) {
      console.error('CompanionMatchingScreen: acceptCompanionRequestDirect 오류:', error);
      throw error;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('CompanionMatchingScreen: 수동 새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 동행자 서비스 철회 처리
  const handleWithdrawCompanionService = async () => {
    if (!user) return;
    
    try {
      setWithdrawing(true);
      setShowWithdrawMessage(false);
      setWithdrawMessage('');
      
      const result = await withdrawCompanionService(user.uid, queueId);
      
      if (result.success) {
        setWithdrawMessage(result.message);
        setShowWithdrawMessage(true);
        
        // 3초 후 메시지 숨기기
        setTimeout(() => {
          setShowWithdrawMessage(false);
          setWithdrawMessage('');
        }, 3000);
        
        // 데이터 새로고침
        await loadData();
      }
    } catch (error) {
      console.error('동행자 서비스 철회 실패:', error);
      setWithdrawMessage('철회 중 오류가 발생했습니다.');
      setShowWithdrawMessage(true);
      
      setTimeout(() => {
        setShowWithdrawMessage(false);
        setWithdrawMessage('');
      }, 3000);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAcceptRequest = async (request: CompanionRequestData) => {
    if (!user || !queue) {
      Alert.alert('오류', '사용자 또는 대기열 정보가 없습니다.');
      return;
    }

    console.log('CompanionMatchingScreen: 동행자 요청 수락 시작:', {
      requestId: request.id,
      userId: user.uid,
      queueId,
      queueNumber: queue.queueNumber
    });

    // Alert.alert 제거하고 직접 실행
    try {
      setAcceptingRequestId(request.id);
      
      // 파라미터 유효성 검사
      if (!request.id || !user.uid || !queue.id || queue.queueNumber === undefined) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }
      
      try {
        await acceptCompanionRequestDirect(
           request.id,
           user.uid,
           queue.id,
           queue.queueNumber
         );
      } catch (functionError) {
        console.error('CompanionMatchingScreen: 직접 구현 함수 내부 오류:', functionError);
        throw functionError;
      }
       
       // 목록 새로고침
       await loadData();
       
       // 수락된 요청의 상세 정보 가져오기
       const acceptedRequest = await getDoc(doc(db, 'companionRequests', request.id));
       const acceptedData = acceptedRequest.data();
       
       // 연동된 번호 정보 구성
       const originalNumber = queue.queueNumber;
       const linkedNumber = acceptedData?.linkedQueueNumber || originalNumber;
       const isNumberChanged = linkedNumber !== originalNumber;
       
       const message = `동행자 요청을 수락했습니다!\n\n` +
         `📋 연동 정보:\n` +
         `• 내 원본 번호: ${originalNumber}번\n` +
         `• 요청자 원본 번호: ${acceptedData?.originalQueueNumber || '확인 중'}번\n` +
         `• 연동된 번호: ${linkedNumber}번\n\n` +
         `${isNumberChanged ? 
           `🔄 번호가 ${originalNumber}번 → ${linkedNumber}번으로 변경되었습니다.\n` +
           `(동반자와 요청자 중 뒷번호로 연동)` : 
           `✅ 번호가 변경되지 않았습니다.`
         }\n\n` +
         `이제 함께 입장할 수 있습니다!`;
       
       Alert.alert(
         '수락 완료',
         message,
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
      {/* 철회 메시지 표시 */}
      {showWithdrawMessage && (
        <View style={styles.withdrawMessageContainer}>
          <Text style={styles.withdrawMessageText}>{withdrawMessage}</Text>
        </View>
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>동행자 요청 목록</Text>
        <Text style={styles.subtitle}>수락 가능한 동행자 요청을 확인하세요</Text>
      </View>

      {/* 현재 대기열 정보 */}
      {queue && (
        <View style={styles.queueInfoSection}>
          <Text style={styles.sectionTitle}>현재 대기열 정보</Text>
          <View style={styles.queueInfo}>
            <Text style={styles.queueInfoLabel}>순번</Text>
            <Text style={styles.queueInfoValue}>
              {queue.originalQueueNumber || queue.queueNumber} → {queue.queueNumber}번
            </Text>
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

             {/* 동행자 상태 표시 */}
       {isCompanion && companionInfo && (
         <View style={styles.companionStatusSection}>
           <Text style={styles.sectionTitle}>동행자 상태</Text>
           <View style={styles.companionStatusCard}>
             <View style={styles.statusHeader}>
               <Text style={styles.statusTitle}>✅ 동행자 매칭 완료</Text>
               <Text style={styles.statusTime}>{formatTime(companionInfo.createdAt)}</Text>
             </View>
             <View style={styles.statusDetails}>
                                                <View style={styles.detailRow}>
                   <Text style={styles.detailLabel}>순번</Text>
                   <View style={styles.queueNumberContainer}>
                     <Text style={styles.detailValue}>
                       {companionInfo.originalQueueNumber || queue?.queueNumber} → {companionInfo.linkedQueueNumber || '연동 중'}번
                     </Text>
                   </View>
                 </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>수령 예정 금액</Text>
                 <Text style={styles.detailValue}>{formatPrice(companionInfo.earnedAmount)}원</Text>
               </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>상태</Text>
                 <Text style={styles.detailValue}>
                   {companionInfo.status === 'waiting' ? '대기 중' : '활성'}
                 </Text>
               </View>
             </View>
             <View style={styles.withdrawButtonContainer}>
               <Text style={styles.withdrawWarningText}>
                 ⚠️ 철회 시 앞으로 동반자 기능이 비활성화될 수 있습니다
               </Text>
               <Button
                 title={withdrawing ? "철회 중..." : "동반자 서비스 철회"}
                 onPress={handleWithdrawCompanionService}
                 disabled={withdrawing}
                 variant="outline"
                 style={styles.withdrawButton}
                 textStyle={styles.withdrawButtonText}
               />
             </View>
           </View>
         </View>
       )}

       {/* 요청자 상태 표시 */}
       {isRequester && requesterInfo && (
         <View style={styles.requesterStatusSection}>
           <Text style={styles.sectionTitle}>동행자 요청 상태</Text>
           <View style={styles.requesterStatusCard}>
             <View style={styles.statusHeader}>
               <Text style={styles.statusTitle}>🎉 동행자 매칭 성공</Text>
               <Text style={styles.statusTime}>{formatTime(requesterInfo.matchedAt)}</Text>
             </View>
             <View style={styles.statusDetails}>
                               <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>순번</Text>
                  <View style={styles.queueNumberContainer}>
                    <Text style={styles.detailValue}>
                      {requesterInfo.originalQueueNumber || queue?.queueNumber} → {requesterInfo.linkedQueueNumber || '연동 중'}번
                    </Text>
                  </View>
                </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>지불 금액</Text>
                 <Text style={styles.detailValue}>{formatPrice(requesterInfo.offeredPrice)}원</Text>
               </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>상태</Text>
                 <Text style={styles.detailValue}>매칭 완료</Text>
               </View>
             </View>
             <View style={styles.withdrawButtonContainer}>
               <Text style={styles.withdrawWarningText}>
                 ⚠️ 철회 시 수수료가 부과됩니다
               </Text>
               <Button
                 title={withdrawing ? "철회 중..." : "동반자 서비스 철회"}
                 onPress={handleWithdrawCompanionService}
                 disabled={withdrawing}
                 variant="outline"
                 style={styles.withdrawButton}
                 textStyle={styles.withdrawButtonText}
               />
             </View>
           </View>
         </View>
       )}

       {/* 요청 중 상태 표시 */}
       {isRequesting && requestingInfo && (
         <View style={styles.requestingStatusSection}>
           <Text style={styles.sectionTitle}>동행자 요청 중</Text>
           <View style={styles.requestingStatusCard}>
             <View style={styles.statusHeader}>
               <Text style={styles.statusTitle}>⏳ 동행자 요청 대기 중</Text>
               <Text style={styles.statusTime}>{formatTime(requestingInfo.createdAt)}</Text>
             </View>
             <View style={styles.statusDetails}>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>제안 금액</Text>
                 <Text style={styles.detailValue}>{formatPrice(requestingInfo.offeredPrice)}원</Text>
               </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>검색 범위</Text>
                 <Text style={styles.detailValue}>±{requestingInfo.searchRange}칸</Text>
               </View>
               <View style={styles.detailRow}>
                 <Text style={styles.detailLabel}>상태</Text>
                 <Text style={styles.detailValue}>매칭 대기 중</Text>
               </View>
             </View>
             <View style={styles.requestingNote}>
               <Text style={styles.requestingNoteText}>
                 • 동행자 요청 중에는 다른 요청을 수락할 수 없습니다{'\n'}
                 • 요청을 취소하려면 동행자 요청 화면으로 이동하세요
               </Text>
             </View>
           </View>
         </View>
       )}

       {/* 동행자 요청 목록 (동행자가 아니고 매칭된 요청이 없고 요청 중이 아닌 경우에만) */}
       {!isCompanion && !isRequester && !isRequesting && (
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
                     <Text style={styles.detailLabel}>요청자 번호</Text>
                     <View style={styles.queueNumberContainer}>
                       <Text style={styles.detailValue}>
                         {request.originalQueueNumber} → {request.linkedQueueNumber || '연동 중'}번
                       </Text>
                     </View>
                   </View>
                   <View style={styles.detailRow}>
                     <Text style={styles.detailLabel}>제안 금액</Text>
                     <Text style={styles.detailValue}>{formatPrice(request.offeredPrice)}원</Text>
                   </View>
                   <View style={styles.detailRow}>
                     <Text style={styles.detailLabel}>연동 후 번호</Text>
                     <View style={styles.queueNumberContainer}>
                       <Text style={styles.detailValue}>
                         {request.linkedQueueNumber ? `${request.linkedQueueNumber}번` : '연동 중'}
                       </Text>
                       {request.linkedQueueNumber && request.linkedQueueNumber !== request.originalQueueNumber && (
                         <Text style={styles.numberChangeNote}> (뒷번호로 연동)</Text>
                       )}
                     </View>
                   </View>
                 </View>
                 
                 <TouchableOpacity
                   style={[
                     styles.acceptButton,
                     acceptingRequestId === request.id && styles.acceptButtonDisabled
                   ]}
                   onPress={() => {
                     handleAcceptRequest(request);
                   }}
                   disabled={acceptingRequestId === request.id}
                   activeOpacity={0.6}
                   hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
       )}

      {/* 안내 정보 */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>수락 시 안내</Text>
        <Text style={styles.infoText}>
                     • 동반자와 요청자 중 뒷번호로 순번이 연동됩니다{'\n'}
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
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 50,
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
  companionStatusSection: {
    marginBottom: 20,
  },
  companionStatusCard: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requesterStatusSection: {
    marginBottom: 20,
  },
  requesterStatusCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  statusTime: {
    fontSize: 14,
    color: '#666',
  },
  statusDetails: {
    marginBottom: 10,
  },
  queueNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  requestingStatusSection: {
    marginBottom: 20,
  },
  requestingStatusCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestingNote: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  requestingNoteText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  withdrawMessageContainer: {
    backgroundColor: '#007AFF',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  withdrawMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  withdrawButtonContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  withdrawButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  withdrawButtonText: {
    color: '#FFFFFF',
  },
  withdrawWarningText: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  numberChangeNote: {
    fontSize: 12,
    color: '#FF3B30',
    fontStyle: 'italic',
  },
});

export default CompanionMatchingScreen;
