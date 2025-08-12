import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  CompanionRequest, 
  Companion, 
  CompanionRequestData, 
  CompanionData,
  QueueEntry
} from '../types/firestore';
import { logError } from '../utils/errorUtils';

// 동행자 요청 생성
export const createCompanionRequest = async (
  userId: string,
  queueId: string,
  originalQueueNumber: number,
  offeredPrice: number
): Promise<string> => {
  try {
    console.log('동행자 요청 생성 시작:', { userId, queueId, originalQueueNumber, offeredPrice });
    
    // 대기열 정보 조회하여 eventId와 timeSlotId 가져오기
    const queueRef = doc(db, 'queues', queueId);
    const queueDoc = await getDoc(queueRef);
    
    if (!queueDoc.exists()) {
      throw new Error('대기열을 찾을 수 없습니다.');
    }
    
    const queueData = queueDoc.data();
    const eventId = queueData.eventId;
    const timeSlotId = queueData.timeSlotId;
    
    console.log('대기열 정보 조회:', { eventId, timeSlotId });
    
    const companionRequest: Omit<CompanionRequest, 'id'> = {
      userId,
      queueId,
      eventId,
      timeSlotId,
      originalQueueNumber,
      offeredPrice,
      status: 'pending',
      searchRange: 5, // 초기 검색 범위 ±5칸
      createdAt: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'companionRequests'), companionRequest);
    console.log('동행자 요청 생성 성공:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('동행자 요청 생성 실패:', error);
    logError('동행자 요청 생성 실패:', error);
    throw error;
  }
};

// 동행자 요청 조회
export const getCompanionRequest = async (requestId: string): Promise<CompanionRequestData | null> => {
  try {
    const docRef = doc(db, 'companionRequests', requestId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as CompanionRequest;
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt.toDate(),
        matchedAt: data.matchedAt?.toDate(),
      };
    }
    return null;
  } catch (error) {
    logError('동행자 요청 조회 실패:', error);
    throw error;
  }
};

// 대기열의 동행자 요청 목록 조회
export const getCompanionRequestsByQueue = async (queueId: string): Promise<CompanionRequestData[]> => {
  try {
    console.log('동행자 요청 목록 조회 시작:', queueId);
    
    const q = query(
      collection(db, 'companionRequests'),
      where('queueId', '==', queueId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const requests: CompanionRequestData[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as CompanionRequest;
      requests.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        matchedAt: data.matchedAt?.toDate(),
      });
    });
    
    console.log(`동행자 요청 목록 조회 완료: ${requests.length}개 요청 발견`);
    return requests;
  } catch (error) {
    console.error('동행자 요청 목록 조회 실패:', error);
    logError('동행자 요청 목록 조회 실패:', error);
    throw error;
  }
};

// 범위 내 동행자 검색
export const findCompanionsInRange = async (
  queueId: string,
  centerNumber: number,
  range: number
): Promise<QueueEntry[]> => {
  try {
    const minNumber = Math.max(1, centerNumber - range);
    const maxNumber = centerNumber + range;
    
    // 먼저 대기열 자체를 확인
    const queueRef = doc(db, 'queues', queueId);
    const queueDoc = await getDoc(queueRef);
    
    if (!queueDoc.exists()) {
      console.log('대기열을 찾을 수 없음:', queueId);
      return [];
    }
    
    // 대기열 항목들을 조회 (메인 컬렉션 사용)
    const q = query(
      collection(db, 'queues'),
      where('queueId', '==', queueId),
      where('status', '==', 'waiting'),
      where('queueNumber', '>=', minNumber),
      where('queueNumber', '<=', maxNumber)
    );
    
    const querySnapshot = await getDocs(q);
    const companions: QueueEntry[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // 동행자 서비스를 사용하지 않는 사용자만 필터링
      if (!data.isCompanionService) {
        companions.push({
          id: doc.id,
          ...data
        } as QueueEntry);
      }
    });
    
    console.log(`범위 ${minNumber}-${maxNumber}에서 ${companions.length}명의 동행자 후보 발견`);
    return companions;
  } catch (error) {
    logError('범위 내 동행자 검색 실패:', error);
    throw error;
  }
};

// 동행자 요청 수락
export const acceptCompanionRequest = async (
  requestId: string,
  companionUserId: string,
  companionQueueId: string,
  companionOriginalNumber: number
): Promise<void> => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. 동행자 요청 조회
      const requestRef = doc(db, 'companionRequests', requestId);
      const requestDoc = await transaction.get(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('동행자 요청을 찾을 수 없습니다.');
      }
      
      const requestData = requestDoc.data() as CompanionRequest;
      
      if (requestData.status !== 'pending') {
        throw new Error('이미 처리된 요청입니다.');
      }
      
      // 2. 동행자 생성
      const companionData: Omit<Companion, 'id'> = {
        userId: companionUserId,
        requestId,
        queueId: companionQueueId,
        originalQueueNumber: companionOriginalNumber,
        status: 'waiting',
        earnedAmount: requestData.offeredPrice,
        createdAt: serverTimestamp() as Timestamp,
      };
      
      const companionRef = doc(collection(db, 'companions'));
      transaction.set(companionRef, companionData);
      
      // 3. 요청 상태 업데이트
      const linkedNumber = Math.max(requestData.originalQueueNumber, companionOriginalNumber);
      
      transaction.update(requestRef, {
        status: 'matched',
        matchedAt: serverTimestamp(),
        companionId: companionRef.id,
        linkedQueueNumber: linkedNumber,
      });
      
      // 4. 대기열 번호 연동 (메인 컬렉션 사용)
      // 요청자 대기열 찾기
      const requesterQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', requestData.eventId),
        where('timeSlotId', '==', requestData.timeSlotId),
        where('userId', '==', requestData.userId)
      );
      const requesterSnapshot = await transaction.get(requesterQuery);
      
      // 동행자 대기열 찾기
      const companionQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', requestData.eventId),
        where('timeSlotId', '==', requestData.timeSlotId),
        where('userId', '==', companionUserId)
      );
      const companionSnapshot = await transaction.get(companionQuery);
      
      if (!requesterSnapshot.empty) {
        const requesterDoc = requesterSnapshot.docs[0];
        transaction.update(requesterDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'requester',
          displayLabel: '',
          originalQueueNumber: requestData.originalQueueNumber,
        });
      }
      
      if (!companionSnapshot.empty) {
        const companionDoc = companionSnapshot.docs[0];
        transaction.update(companionDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'companion',
          displayLabel: '(동행자)',
          originalQueueNumber: companionOriginalNumber,
        });
      }
    });
    
    console.log('동행자 요청 수락 완료:', requestId);
  } catch (error) {
    logError('동행자 요청 수락 실패:', error);
    throw error;
  }
};

// 동행자 요청 취소
export const cancelCompanionRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'companionRequests', requestId);
    await updateDoc(requestRef, {
      status: 'cancelled',
    });
    
    console.log('동행자 요청 취소 완료:', requestId);
  } catch (error) {
    logError('동행자 요청 취소 실패:', error);
    throw error;
  }
};

// 동행자 요청 금액 수정
export const updateCompanionRequestPrice = async (
  requestId: string,
  newPrice: number
): Promise<void> => {
  try {
    if (newPrice < 10000) {
      throw new Error('최소 금액은 10,000원입니다.');
    }
    
    const requestRef = doc(db, 'companionRequests', requestId);
    await updateDoc(requestRef, {
      offeredPrice: newPrice,
    });
    
    console.log('동행자 요청 금액 수정 완료:', requestId, newPrice);
  } catch (error) {
    logError('동행자 요청 금액 수정 실패:', error);
    throw error;
  }
};

// 범위 확장 (1분마다 호출)
export const expandSearchRange = async (requestId: string): Promise<void> => {
  try {
    const request = await getCompanionRequest(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }
    
    const elapsedMinutes = Math.floor((Date.now() - request.createdAt.getTime()) / (1000 * 60));
    const newRange = Math.min(5 + (elapsedMinutes * 5), 50); // 최대 ±50칸
    
    if (newRange > request.searchRange) {
      const requestRef = doc(db, 'companionRequests', requestId);
      await updateDoc(requestRef, {
        searchRange: newRange,
      });
      
      console.log('검색 범위 확장:', requestId, newRange);
    }
  } catch (error) {
    logError('검색 범위 확장 실패:', error);
    throw error;
  }
};

// 사용자의 동행자 요청 조회
export const getUserCompanionRequests = async (userId: string): Promise<CompanionRequestData[]> => {
  try {
    const q = query(
      collection(db, 'companionRequests'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const requests: CompanionRequestData[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as CompanionRequest;
      requests.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        matchedAt: data.matchedAt?.toDate(),
      });
    });
    
    return requests;
  } catch (error) {
    logError('사용자 동행자 요청 조회 실패:', error);
    throw error;
  }
};

// 사용자의 동행자 활동 조회
export const getUserCompanionActivities = async (userId: string): Promise<CompanionData[]> => {
  try {
    const q = query(
      collection(db, 'companions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const companions: CompanionData[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Companion;
      companions.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
      });
    });
    
    return companions;
  } catch (error) {
    logError('사용자 동행자 활동 조회 실패:', error);
    throw error;
  }
};
