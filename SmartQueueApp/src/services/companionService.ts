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

// 완전히 새로운 테스트 함수
export const simpleTest = () => {
  console.log('simpleTest: 함수가 호출되었습니다!');
  return '성공';
};

// 동행자 요청 생성
export const createCompanionRequest = async (
  userId: string,
  queueId: string,
  originalQueueNumber: number,
  offeredPrice: number
): Promise<string> => {
  try {
    console.log('동행자 요청 생성 시작:', { userId, queueId, originalQueueNumber, offeredPrice });
    
    // 기존 철회된 요청이 있으면 삭제
    const existingWithdrawnQuery = query(
      collection(db, 'companionRequests'),
      where('userId', '==', userId),
      where('queueId', '==', queueId),
      where('status', '==', 'withdrawn_by_companion')
    );
    const existingWithdrawnSnapshot = await getDocs(existingWithdrawnQuery);
    
    if (!existingWithdrawnSnapshot.empty) {
      const deletePromises = existingWithdrawnSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log('기존 철회된 요청 삭제 완료:', existingWithdrawnSnapshot.docs.length);
    }
    
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
    
    // 먼저 대기열 정보를 가져와서 eventId와 timeSlotId 확인
    const queueRef = doc(db, 'queues', queueId);
    const queueDoc = await getDoc(queueRef);
    
    if (!queueDoc.exists()) {
      console.log('대기열을 찾을 수 없음:', queueId);
      return [];
    }
    
    const queueData = queueDoc.data();
    const eventId = queueData.eventId;
    const timeSlotId = queueData.timeSlotId;
    
    console.log('대기열 정보:', { eventId, timeSlotId });
    
    const q = query(
      collection(db, 'queues'),
      where('eventId', '==', eventId),
      where('timeSlotId', '==', timeSlotId),
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

// 테스트용 간단한 함수
export const testFunction = async (): Promise<string> => {
  console.log('testFunction: 함수 진입');
  return '테스트 성공';
};

// 동행자 요청 수락
export const acceptCompanionRequest = async (
  requestId: string,
  companionUserId: string,
  companionQueueId: string,
  companionOriginalNumber: number
): Promise<void> => {
  console.log('acceptCompanionRequest: 함수 진입');
  console.log('acceptCompanionRequest: 파라미터 확인:', { requestId, companionUserId, companionQueueId, companionOriginalNumber });
  
  try {
    console.log('acceptCompanionRequest: 함수 시작', {
      requestId,
      companionUserId,
      companionQueueId,
      companionOriginalNumber
    });
    
    // Firebase 연결 상태 확인
    console.log('acceptCompanionRequest: Firebase db 객체 확인:', {
      dbExists: !!db,
      dbType: typeof db,
      dbApp: db?.app?.name,
      dbPath: db?.app?.options?.projectId
    });
    
    if (!db) {
      throw new Error('Firebase db 객체가 초기화되지 않았습니다.');
    }
    
    // 먼저 runTransaction 없이 단순 조회만 해보기
    console.log('acceptCompanionRequest: 단순 조회 테스트 시작');
    
    // 1. 동행자 요청 조회 (runTransaction 없이)
    console.log('acceptCompanionRequest: 1단계 - 동행자 요청 조회 시작 (단순 조회)');
    const requestRef = doc(db, 'companionRequests', requestId);
    
    console.log('acceptCompanionRequest: requestRef 생성됨:', requestRef.path);
    
    try {
      const requestDoc = await getDoc(requestRef);
      console.log('acceptCompanionRequest: getDoc 완료');
      console.log('acceptCompanionRequest: 요청 문서 존재 여부:', requestDoc.exists());
      
      if (!requestDoc.exists()) {
        throw new Error('동행자 요청을 찾을 수 없습니다.');
      }
      
      const requestData = requestDoc.data() as CompanionRequest;
      console.log('acceptCompanionRequest: 요청 데이터:', {
        status: requestData.status,
        eventId: requestData.eventId,
        timeSlotId: requestData.timeSlotId,
        userId: requestData.userId
      });
      
      if (requestData.status !== 'pending') {
        throw new Error('이미 처리된 요청입니다.');
      }
      
      console.log('acceptCompanionRequest: 단순 조회 테스트 완료 - 이제 runTransaction 시작');
    } catch (getDocError) {
      console.error('acceptCompanionRequest: getDoc 오류:', getDocError);
      throw new Error(`동행자 요청 조회 실패: ${getDocError.message}`);
    }
    
    // 이제 runTransaction 시작
    console.log('acceptCompanionRequest: runTransaction 시작');
    await runTransaction(db, async (transaction) => {
      console.log('acceptCompanionRequest: 트랜잭션 내부 시작');
      
      // 1. 동행자 요청 조회 (트랜잭션 내부)
      console.log('acceptCompanionRequest: 1단계 - 동행자 요청 조회 시작 (트랜잭션)');
      const requestRef = doc(db, 'companionRequests', requestId);
      const requestDoc = await transaction.get(requestRef);
      
      console.log('acceptCompanionRequest: 요청 문서 존재 여부 (트랜잭션):', requestDoc.exists());
      
      if (!requestDoc.exists()) {
        throw new Error('동행자 요청을 찾을 수 없습니다.');
      }
      
      const requestData = requestDoc.data() as CompanionRequest;
      console.log('acceptCompanionRequest: 요청 데이터 (트랜잭션):', {
        status: requestData.status,
        eventId: requestData.eventId,
        timeSlotId: requestData.timeSlotId,
        userId: requestData.userId
      });
      
      if (requestData.status !== 'pending') {
        throw new Error('이미 처리된 요청입니다.');
      }
      
      // 2. 동행자 생성
      console.log('acceptCompanionRequest: 2단계 - 동행자 생성 시작');
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
      console.log('acceptCompanionRequest: 동행자 문서 생성됨:', companionRef.id);
      
      // 3. 요청 상태 업데이트
      console.log('acceptCompanionRequest: 3단계 - 요청 상태 업데이트 시작');
      const linkedNumber = Math.max(requestData.originalQueueNumber, companionOriginalNumber);
      console.log('acceptCompanionRequest: 연동 번호 계산:', linkedNumber);
      
      transaction.update(requestRef, {
        status: 'matched',
        matchedAt: serverTimestamp(),
        companionId: companionRef.id,
        linkedQueueNumber: linkedNumber,
      });
      
      // 4. 대기열 번호 연동 (메인 컬렉션 사용)
      console.log('acceptCompanionRequest: 4단계 - 대기열 번호 연동 시작');
      
      // 요청자 대기열 찾기
      console.log('acceptCompanionRequest: 요청자 대기열 검색 시작');
      const requesterQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', requestData.eventId),
        where('timeSlotId', '==', requestData.timeSlotId),
        where('userId', '==', requestData.userId)
      );
      const requesterSnapshot = await transaction.get(requesterQuery);
      console.log('acceptCompanionRequest: 요청자 대기열 검색 결과:', requesterSnapshot.size, '개');
      
      // 동행자 대기열 찾기 (동행자의 대기열 정보 사용)
      console.log('acceptCompanionRequest: 동행자 대기열 문서 조회 시작');
      const companionQueueRef = doc(db, 'queues', companionQueueId);
      const companionQueueDoc = await transaction.get(companionQueueRef);
      
      console.log('acceptCompanionRequest: 동행자 대기열 문서 존재 여부:', companionQueueDoc.exists());
      
      if (!companionQueueDoc.exists()) {
        throw new Error('동행자 대기열을 찾을 수 없습니다.');
      }
      
      const companionQueueData = companionQueueDoc.data();
      const companionEventId = companionQueueData.eventId;
      const companionTimeSlotId = companionQueueData.timeSlotId;
      
      console.log('acceptCompanionRequest: 동행자 대기열 정보:', { 
        companionEventId, 
        companionTimeSlotId, 
        companionUserId,
        requestEventId: requestData.eventId,
        requestTimeSlotId: requestData.timeSlotId
      });
      
      // 요청자와 동행자가 같은 이벤트/타임슬롯에 있는지 확인
      if (requestData.eventId !== companionEventId || requestData.timeSlotId !== companionTimeSlotId) {
        throw new Error('요청자와 동행자가 다른 이벤트 또는 타임슬롯에 있습니다.');
      }
      
      console.log('acceptCompanionRequest: 동행자 대기열 검색 시작');
      const companionQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', companionEventId),
        where('timeSlotId', '==', companionTimeSlotId),
        where('userId', '==', companionUserId)
      );
      const companionSnapshot = await transaction.get(companionQuery);
      console.log('acceptCompanionRequest: 동행자 대기열 검색 결과:', companionSnapshot.size, '개');
      
      if (!requesterSnapshot.empty) {
        console.log('acceptCompanionRequest: 요청자 대기열 업데이트 시작');
        const requesterDoc = requesterSnapshot.docs[0];
        transaction.update(requesterDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'requester',
          displayLabel: '',
          originalQueueNumber: requestData.originalQueueNumber,
        });
        console.log('acceptCompanionRequest: 요청자 대기열 업데이트 완료');
      }
      
      if (!companionSnapshot.empty) {
        console.log('acceptCompanionRequest: 동행자 대기열 업데이트 시작');
        const companionDoc = companionSnapshot.docs[0];
        transaction.update(companionDoc.ref, {
          queueNumber: linkedNumber,
          isCompanionService: true,
          companionType: 'companion',
          displayLabel: '(동행자)',
          originalQueueNumber: companionOriginalNumber,
        });
        console.log('acceptCompanionRequest: 동행자 대기열 업데이트 완료');
      }
      
      console.log('acceptCompanionRequest: 트랜잭션 내부 완료');
    });
    
    console.log('acceptCompanionRequest: runTransaction 완료');
    console.log('동행자 요청 수락 완료:', requestId);
  } catch (error) {
    console.error('acceptCompanionRequest: 오류 발생:', error);
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

// 모든 동행자 기록 삭제 (관리자용)
export const deleteAllCompanionRecords = async (): Promise<void> => {
  try {
    console.log('동행자 기록 삭제 시작...');
    
    // 1. 모든 동행자 요청 삭제
    const requestsQuery = query(collection(db, 'companionRequests'));
    const requestsSnapshot = await getDocs(requestsQuery);
    
    const requestDeletions = requestsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(requestDeletions);
    console.log(`${requestsSnapshot.docs.length}개의 동행자 요청 삭제 완료`);
    
    // 2. 모든 동행자 매칭 삭제
    const companionsQuery = query(collection(db, 'companions'));
    const companionsSnapshot = await getDocs(companionsQuery);
    
    const companionDeletions = companionsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(companionDeletions);
    console.log(`${companionsSnapshot.docs.length}개의 동행자 매칭 삭제 완료`);
    
    // 3. 대기열에서 동행자 연동 상태 해제
    const queuesQuery = query(
      collection(db, 'queues'),
      where('isCompanionService', '==', true)
    );
    const queuesSnapshot = await getDocs(queuesQuery);
    
    const queueUpdates = queuesSnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        isCompanionService: false,
        companionType: null,
        displayLabel: null,
        linkedQueueNumber: null,
        originalQueueNumber: null,
      })
    );
    
    await Promise.all(queueUpdates);
    console.log(`${queuesSnapshot.docs.length}개의 대기열 동행자 연동 해제 완료`);
    
    console.log('모든 동행자 기록 삭제 완료');
  } catch (error) {
    logError('동행자 기록 삭제 실패:', error);
    throw error;
  }
};

// 특정 사용자의 동행자 기록 삭제
export const deleteUserCompanionRecords = async (userId: string): Promise<void> => {
  try {
    console.log(`사용자 ${userId}의 동행자 기록 삭제 시작...`);
    
    // 1. 사용자의 동행자 요청 삭제
    const requestsQuery = query(
      collection(db, 'companionRequests'),
      where('userId', '==', userId)
    );
    const requestsSnapshot = await getDocs(requestsQuery);
    
    const requestDeletions = requestsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(requestDeletions);
    console.log(`${requestsSnapshot.docs.length}개의 사용자 동행자 요청 삭제 완료`);
    
    // 2. 사용자의 동행자 매칭 삭제
    const companionsQuery = query(
      collection(db, 'companions'),
      where('userId', '==', userId)
    );
    const companionsSnapshot = await getDocs(companionsQuery);
    
    const companionDeletions = companionsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    
    await Promise.all(companionDeletions);
    console.log(`${companionsSnapshot.docs.length}개의 사용자 동행자 매칭 삭제 완료`);
    
    // 3. 사용자의 대기열에서 동행자 연동 상태 해제
    const queuesQuery = query(
      collection(db, 'queues'),
      where('userId', '==', userId),
      where('isCompanionService', '==', true)
    );
    const queuesSnapshot = await getDocs(queuesQuery);
    
    const queueUpdates = queuesSnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        isCompanionService: false,
        companionType: null,
        displayLabel: null,
        linkedQueueNumber: null,
        originalQueueNumber: null,
      })
    );
    
    await Promise.all(queueUpdates);
    console.log(`${queuesSnapshot.docs.length}개의 사용자 대기열 동행자 연동 해제 완료`);
    
    console.log(`사용자 ${userId}의 모든 동행자 기록 삭제 완료`);
  } catch (error) {
    logError('사용자 동행자 기록 삭제 실패:', error);
    throw error;
  }
};

// 동행자 서비스 철회 (수수료 부과)
export const withdrawCompanionService = async (
  userId: string,
  queueId: string
): Promise<{ success: boolean; fee: number; message: string }> => {
  try {
    console.log('동행자 서비스 철회 시작:', { userId, queueId });
    
    // 1. 사용자의 동행자 상태 확인
    const companionQuery = query(
      collection(db, 'companions'),
      where('userId', '==', userId),
      where('queueId', '==', queueId),
      where('status', 'in', ['waiting', 'active'])
    );
    const companionSnapshot = await getDocs(companionQuery);
    
    const requesterQuery = query(
      collection(db, 'companionRequests'),
      where('userId', '==', userId),
      where('queueId', '==', queueId),
      where('status', '==', 'matched')
    );
    const requesterSnapshot = await getDocs(requesterQuery);
    
    if (companionSnapshot.empty && requesterSnapshot.empty) {
      throw new Error('철회 가능한 동행자 서비스가 없습니다.');
    }
    
    // 2. 수수료 계산 (제안 금액의 20%)
    let fee = 0;
    let requestId = '';
    
    if (!requesterSnapshot.empty) {
      const requestData = requesterSnapshot.docs[0].data();
      fee = Math.floor(requestData.offeredPrice * 0.2); // 20% 수수료
      requestId = requesterSnapshot.docs[0].id;
    } else if (!companionSnapshot.empty) {
      const companionData = companionSnapshot.docs[0].data();
      // 동행자인 경우 원본 요청에서 제안 금액 확인
      if (companionData.requestId) {
        const originalRequestQuery = query(
          collection(db, 'companionRequests'),
          where('__name__', '==', companionData.requestId)
        );
        const originalRequestSnapshot = await getDocs(originalRequestQuery);
        if (!originalRequestSnapshot.empty) {
          const originalRequestData = originalRequestSnapshot.docs[0].data();
          fee = Math.floor(originalRequestData.offeredPrice * 0.2); // 20% 수수료
        }
      }
    }
    
    // 3. 트랜잭션으로 철회 처리
    await runTransaction(db, async (transaction) => {
      // 동행자 매칭 삭제
      if (!companionSnapshot.empty) {
        const companionDoc = companionSnapshot.docs[0];
        const companionData = companionDoc.data();
        transaction.delete(companionDoc.ref);
        
        // 동행자가 철회한 경우 요청 상태를 'withdrawn_by_companion'으로 변경
        if (companionData.requestId) {
          const requestRef = doc(db, 'companionRequests', companionData.requestId);
          transaction.update(requestRef, {
            status: 'withdrawn_by_companion',
            withdrawnAt: serverTimestamp()
          });
        }
      }
      
      // 요청자 매칭 삭제
      if (!requesterSnapshot.empty) {
        const requesterDoc = requesterSnapshot.docs[0];
        transaction.update(requesterDoc.ref, {
          status: 'cancelled',
          cancelledAt: serverTimestamp()
        });
        
        // 관련된 동행자 매칭 삭제
        const relatedCompanionQuery = query(
          collection(db, 'companions'),
          where('requestId', '==', requesterDoc.id)
        );
        const relatedCompanionSnapshot = await getDocs(relatedCompanionQuery);
        if (!relatedCompanionSnapshot.empty) {
          transaction.delete(relatedCompanionSnapshot.docs[0].ref);
        }
      }
      
      // 대기열 정보에서 동행자 관련 필드 제거
      const queueRef = doc(db, 'queues', queueId);
      transaction.update(queueRef, {
        isCompanionService: false,
        companionType: null,
        displayLabel: null,
        linkedQueueNumber: null,
        originalQueueNumber: null
      });
    });
    
    console.log('동행자 서비스 철회 완료:', { fee });
    return {
      success: true,
      fee,
      message: `동행자 서비스가 철회되었습니다. 수수료: ${fee}원`
    };
    
  } catch (error) {
    console.error('동행자 서비스 철회 실패:', error);
    logError('동행자 서비스 철회 실패:', error);
    throw error;
  }
};
