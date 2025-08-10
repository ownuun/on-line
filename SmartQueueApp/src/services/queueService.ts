import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Queue,
  QueueEntry,
  QueueData,
  QueueEntryData,
  QueueSummary,
  TimeSlot,
} from '../types/firestore';
import {
  convertQueueToData,
  convertQueueEntryToData,
  convertQueueDataToFirestore,
  getCurrentTimestamp,
} from '../utils/firestoreUtils';

export class QueueService {
  private static queuesCollection = collection(db, 'queues');
  private static timeSlotsCollection = collection(db, 'timeSlots');

  /**
   * 대기열에 등록합니다 (트랜잭션 사용).
   */
    static async joinQueue(
    eventId: string,
    timeSlotId: string,
    userId: string
  ): Promise<QueueData> {
    try {
      console.log('QueueService: 대기열 등록 시작 - 이벤트:', eventId, '타임슬롯:', timeSlotId, '사용자:', userId);
      
      // 트랜잭션 외부에서 중복 체크
      console.log('QueueService: 기존 대기열 확인 중...');
      const existingQueueQuery = query(
        this.queuesCollection,
        where('eventId', '==', eventId),
        where('timeSlotId', '==', timeSlotId),
        where('userId', '==', userId),
        where('status', 'in', ['waiting', 'called'])
      );
      
      const existingQueueSnapshot = await getDocs(existingQueueQuery);
      console.log('QueueService: 기존 대기열 확인 결과 - 문서 수:', existingQueueSnapshot.docs.length);
      if (!existingQueueSnapshot.empty) {
        throw new Error('이미 해당 타임슬롯에 등록되어 있습니다.');
      }
      
      // 다음 순번 계산
      console.log('QueueService: 다음 순번 계산 중...');
      const queueQuery = query(
        this.queuesCollection,
        where('eventId', '==', eventId),
        where('timeSlotId', '==', timeSlotId),
        orderBy('queueNumber', 'desc'),
        limit(1)
      );
      
      const queueSnapshot = await getDocs(queueQuery);
      console.log('QueueService: 순번 계산 결과 - 문서 수:', queueSnapshot.docs.length);
      const nextQueueNumber = queueSnapshot.empty ? 1 : queueSnapshot.docs[0].data().queueNumber + 1;
      console.log('QueueService: 다음 순번:', nextQueueNumber);
      
      const result = await runTransaction(db, async (transaction) => {
        // 1. 타임슬롯 정보 조회
        const timeSlotDoc = doc(this.timeSlotsCollection, timeSlotId);
        const timeSlotSnapshot = await transaction.get(timeSlotDoc);
        
        if (!timeSlotSnapshot.exists()) {
          throw new Error('타임슬롯을 찾을 수 없습니다.');
        }
        
        const timeSlot = timeSlotSnapshot.data() as TimeSlot;
        
        // 2. 타임슬롯이 사용 가능한지 확인
        if (timeSlot.status !== 'available' || timeSlot.currentCount >= timeSlot.maxCapacity) {
          throw new Error('해당 타임슬롯은 더 이상 사용할 수 없습니다.');
        }
        
        // 3. 대기열 항목 생성
        const now = getCurrentTimestamp();
        const queueData: Partial<Queue> = {
          eventId,
          timeSlotId,
          userId,
          queueNumber: nextQueueNumber,
          status: 'waiting',
          estimatedWaitTime: this.calculateEstimatedWaitTime(nextQueueNumber),
          createdAt: now,
          updatedAt: now,
        };
        
        const queueRef = await addDoc(this.queuesCollection, queueData);
        
        // 4. 타임슬롯의 현재 인원 수 증가
        transaction.update(timeSlotDoc, {
          currentCount: increment(1),
          updatedAt: now,
        });
        
        // 5. 타임슬롯이 가득 찼는지 확인하고 상태 업데이트
        if (timeSlot.currentCount + 1 >= timeSlot.maxCapacity) {
          transaction.update(timeSlotDoc, {
            status: 'full',
            updatedAt: now,
          });
        }
        
        console.log('QueueService: 대기열 항목 생성 완료 - ID:', queueRef.id);
        return { id: queueRef.id, ...queueData } as Queue;
      });
      
      console.log('QueueService: 트랜잭션 완료');
      return convertQueueToData(result);
    } catch (error) {
      console.error('QueueService: 대기열 등록 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자의 모든 대기열 상태를 조회합니다.
   */
  static async getUserQueues(userId: string): Promise<QueueData[]> {
    try {
      console.log('QueueService: getUserQueues 시작 - userId:', userId);
      
      // 활성 상태의 모든 대기열 조회
      const q = query(
        this.queuesCollection,
        where('userId', '==', userId),
        where('status', 'in', ['waiting', 'called']),
        orderBy('createdAt', 'desc')
      );
      
      console.log('QueueService: 사용자 대기열 쿼리 실행 중...');
      const querySnapshot = await getDocs(q);
      console.log('QueueService: 쿼리 결과 - 문서 수:', querySnapshot.docs.length);
      
      const queues: QueueData[] = [];
      querySnapshot.forEach((doc) => {
        const queue = { id: doc.id, ...doc.data() } as Queue;
        const convertedQueue = convertQueueToData(queue);
        queues.push(convertedQueue);
        console.log('QueueService: 대기열 추가:', {
          id: convertedQueue.id,
          eventId: convertedQueue.eventId,
          status: convertedQueue.status,
          queueNumber: convertedQueue.queueNumber
        });
      });
      
      console.log('QueueService: 총 대기열 수:', queues.length);
      return queues;
    } catch (error) {
      console.error('QueueService: 사용자 대기열 조회 오류:', error);
      console.error('QueueService: 에러 상세 정보:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Firestore 권한 오류인지 확인
      if ((error as any)?.code === 'permission-denied') {
        throw new Error('대기열 정보에 접근할 권한이 없습니다.');
      }
      
      // 네트워크 오류인지 확인
      if ((error as any)?.code === 'unavailable') {
        throw new Error('네트워크 연결을 확인해주세요.');
      }
      
      throw new Error('대기열 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 대기열 ID로 대기열을 조회합니다.
   */
  static async getQueueById(queueId: string): Promise<QueueData | null> {
    try {
      console.log('QueueService: getQueueById 시작 - queueId:', queueId);
      
      const queueDoc = doc(this.queuesCollection, queueId);
      const queueSnapshot = await getDoc(queueDoc);
      
      if (!queueSnapshot.exists()) {
        console.log('QueueService: 대기열을 찾을 수 없음 - queueId:', queueId);
        return null;
      }
      
      const queue = { id: queueSnapshot.id, ...queueSnapshot.data() } as Queue;
      console.log('QueueService: 대기열 조회 성공:', {
        id: queue.id,
        status: queue.status,
        userId: queue.userId,
        eventId: queue.eventId,
        timeSlotId: queue.timeSlotId
      });
      
      const convertedQueue = convertQueueToData(queue);
      return convertedQueue;
    } catch (error) {
      console.error('QueueService: 대기열 조회 오류:', error);
      console.error('QueueService: 에러 상세 정보:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Firestore 권한 오류인지 확인
      if ((error as any)?.code === 'permission-denied') {
        throw new Error('대기열 정보에 접근할 권한이 없습니다.');
      }
      
      // 네트워크 오류인지 확인
      if ((error as any)?.code === 'unavailable') {
        throw new Error('네트워크 연결을 확인해주세요.');
      }
      
      throw new Error('대기열 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용자의 대기열 상태를 조회합니다 (단일 - 기존 호환성 유지).
   */
  static async getUserQueue(userId: string): Promise<QueueData | null> {
    try {
      console.log('QueueService: getUserQueue 시작 - userId:', userId);
      
      // 인덱스가 생성되었으므로 효율적인 복합 쿼리 사용
      const q = query(
        this.queuesCollection,
        where('userId', '==', userId),
        where('status', 'in', ['waiting', 'called']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      console.log('QueueService: 복합 쿼리 실행 중...');
      const querySnapshot = await getDocs(q);
      console.log('QueueService: 쿼리 결과 - 문서 수:', querySnapshot.docs.length);
      
      if (querySnapshot.empty) {
        console.log('QueueService: 활성 대기열 데이터 없음');
        return null;
      }
      
      const queueDoc = querySnapshot.docs[0];
      const queue = { id: queueDoc.id, ...queueDoc.data() } as Queue;
      console.log('QueueService: 선택된 대기열 데이터:', JSON.stringify(queue, null, 2));
      
      const convertedQueue = convertQueueToData(queue);
      console.log('QueueService: 변환된 대기열 데이터:', JSON.stringify(convertedQueue, null, 2));
      
      return convertedQueue;
    } catch (error) {
      console.error('QueueService: 사용자 대기열 조회 오류:', error);
      console.error('QueueService: 에러 상세 정보:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Firestore 권한 오류인지 확인
      if ((error as any)?.code === 'permission-denied') {
        throw new Error('대기열 정보에 접근할 권한이 없습니다.');
      }
      
      // 네트워크 오류인지 확인
      if ((error as any)?.code === 'unavailable') {
        throw new Error('네트워크 연결을 확인해주세요.');
      }
      
      throw new Error('대기열 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 타임슬롯의 대기열 목록을 조회합니다.
   */
  static async getQueueByTimeSlot(eventId: string, timeSlotId: string): Promise<QueueData[]> {
    try {
      const q = query(
        this.queuesCollection,
        where('eventId', '==', eventId),
        where('timeSlotId', '==', timeSlotId),
        orderBy('queueNumber', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const queues: QueueData[] = [];
      
      querySnapshot.forEach((doc) => {
        const queue = { id: doc.id, ...doc.data() } as Queue;
        queues.push(convertQueueToData(queue));
      });
      
      return queues;
    } catch (error) {
      console.error('타임슬롯 대기열 조회 오류:', error);
      throw new Error('대기열 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 대기열을 취소합니다.
   */
  static async cancelQueue(queueId: string, userId: string): Promise<void> {
    try {
      console.log('QueueService: cancelQueue 시작 - queueId:', queueId, 'userId:', userId);
      
      // 1. 대기열 정보 조회 (트랜잭션 외부에서 먼저 확인)
      console.log('QueueService: 대기열 정보 조회 중...');
      const queueDoc = doc(this.queuesCollection, queueId);
      const queueSnapshot = await getDoc(queueDoc);
      
      if (!queueSnapshot.exists()) {
        console.log('QueueService: 대기열을 찾을 수 없음 - queueId:', queueId);
        throw new Error('대기열을 찾을 수 없습니다.');
      }
      
      const queue = queueSnapshot.data() as Queue;
      console.log('QueueService: 대기열 정보 조회 성공:', {
        id: queueId,
        status: queue.status,
        userId: queue.userId,
        eventId: queue.eventId,
        timeSlotId: queue.timeSlotId
      });
      
      // 2. 사용자 권한 확인
      if (queue.userId !== userId) {
        console.log('QueueService: 권한 없음 - 대기열 userId:', queue.userId, '요청 userId:', userId);
        throw new Error('대기열을 취소할 권한이 없습니다.');
      }
      
      // 3. 대기열 상태 확인
      if (queue.status === 'cancelled') {
        console.log('QueueService: 이미 취소된 대기열 - status:', queue.status);
        throw new Error('이미 취소된 대기열입니다.');
      }
      
      console.log('QueueService: 대기열 상태 확인 완료 - 취소 가능 (status:', queue.status, ')');
      
      // 4. 단순한 업데이트로 대기열 상태 변경
      console.log('QueueService: 대기열 상태를 cancelled로 변경 중...');
      console.log('QueueService: 업데이트할 데이터:', {
        status: 'cancelled',
        updatedAt: getCurrentTimestamp(),
      });
      
      const updateData = {
        status: 'cancelled' as const,
        updatedAt: getCurrentTimestamp(),
      };
      
      console.log('QueueService: updateDoc 호출 전...');
      await updateDoc(queueDoc, updateData);
      console.log('QueueService: updateDoc 호출 완료 - 대기열 취소 성공!');
      
      // 5. 타임슬롯 업데이트 (별도 처리)
      try {
        console.log('QueueService: 타임슬롯 업데이트 시작...');
        const timeSlotDoc = doc(this.timeSlotsCollection, queue.timeSlotId);
        const timeSlotSnapshot = await getDoc(timeSlotDoc);
        
        if (timeSlotSnapshot.exists()) {
          const timeSlot = timeSlotSnapshot.data() as TimeSlot;
          console.log('QueueService: 타임슬롯 정보 조회 성공:', {
            currentCount: timeSlot.currentCount,
            maxCapacity: timeSlot.maxCapacity,
            status: timeSlot.status
          });
          
          const newCurrentCount = Math.max(0, timeSlot.currentCount - 1);
          const newStatus = newCurrentCount < timeSlot.maxCapacity ? 'available' : 'full';
          
          console.log('QueueService: 타임슬롯 업데이트:', {
            newCurrentCount,
            newStatus
          });
          
          await updateDoc(timeSlotDoc, {
            currentCount: newCurrentCount,
            status: newStatus,
            updatedAt: getCurrentTimestamp(),
          });
          
          console.log('QueueService: 타임슬롯 업데이트 완료');
        } else {
          console.log('QueueService: 타임슬롯을 찾을 수 없음 - timeSlotId:', queue.timeSlotId);
        }
      } catch (timeSlotError) {
        console.error('QueueService: 타임슬롯 업데이트 실패 (대기열 취소는 성공):', timeSlotError);
        // 타임슬롯 업데이트 실패는 대기열 취소 성공에 영향을 주지 않음
      }
      
    } catch (error) {
      console.error('QueueService: 대기열 취소 오류:', error);
      console.error('QueueService: 에러 상세 정보:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Firestore 권한 오류인지 확인
      if ((error as any)?.code === 'permission-denied') {
        throw new Error('대기열을 취소할 권한이 없습니다. 관리자에게 문의하세요.');
      }
      
      // 네트워크 오류인지 확인
      if ((error as any)?.code === 'unavailable') {
        throw new Error('네트워크 연결을 확인해주세요.');
      }
      
      // 문서가 존재하지 않는 경우
      if ((error as any)?.code === 'not-found') {
        throw new Error('대기열을 찾을 수 없습니다.');
      }
      
      throw error;
    }
  }

  /**
   * 대기열 상태를 업데이트합니다 (관리자용).
   */
  static async updateQueueStatus(
    queueId: string,
    status: 'waiting' | 'called' | 'entered' | 'cancelled'
  ): Promise<void> {
    try {
      const queueDoc = doc(this.queuesCollection, queueId);
      const updateData: Partial<Queue> = {
        status,
        updatedAt: getCurrentTimestamp(),
      };
      
      if (status === 'called') {
        updateData.calledAt = getCurrentTimestamp();
      } else if (status === 'entered') {
        updateData.enteredAt = getCurrentTimestamp();
      }
      
      await updateDoc(queueDoc, updateData);
    } catch (error) {
      console.error('대기열 상태 업데이트 오류:', error);
      throw new Error('대기열 상태를 업데이트하는데 실패했습니다.');
    }
  }

  /**
   * 타임슬롯의 대기열 요약 정보를 계산합니다.
   */
  static async getQueueSummary(eventId: string, timeSlotId: string): Promise<QueueSummary> {
    try {
      const q = query(
        this.queuesCollection,
        where('eventId', '==', eventId),
        where('timeSlotId', '==', timeSlotId)
      );
      
      const querySnapshot = await getDocs(q);
      let totalCount = 0;
      let waitingCount = 0;
      let calledCount = 0;
      let enteredCount = 0;
      
      querySnapshot.forEach((doc) => {
        const queue = doc.data() as Queue;
        totalCount++;
        
        switch (queue.status) {
          case 'waiting':
            waitingCount++;
            break;
          case 'called':
            calledCount++;
            break;
          case 'entered':
            enteredCount++;
            break;
        }
      });
      
      // 예상 대기 시간 계산 (평균 5분/인)
      const estimatedWaitTime = waitingCount * 5;
      
      return {
        eventId,
        timeSlotId,
        totalCount,
        waitingCount,
        calledCount,
        enteredCount,
        estimatedWaitTime,
      };
    } catch (error) {
      console.error('대기열 요약 조회 오류:', error);
      throw new Error('대기열 요약 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 실시간으로 사용자의 대기열 상태를 구독합니다.
   */
  static subscribeToUserQueue(
    userId: string,
    callback: (queue: QueueData | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.queuesCollection,
        where('userId', '==', userId),
        where('status', 'in', ['waiting', 'called']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          if (querySnapshot.empty) {
            callback(null);
            return;
          }
          
          const queue = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Queue;
          callback(convertQueueToData(queue));
        },
        (error) => {
          console.error('사용자 대기열 실시간 구독 오류:', error);
          onError?.(new Error('실시간 대기열 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('사용자 대기열 구독 설정 오류:', error);
      onError?.(new Error('대기열 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 실시간으로 타임슬롯의 대기열을 구독합니다.
   */
  static subscribeToTimeSlotQueue(
    eventId: string,
    timeSlotId: string,
    callback: (queues: QueueData[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.queuesCollection,
        where('eventId', '==', eventId),
        where('timeSlotId', '==', timeSlotId),
        orderBy('queueNumber', 'asc')
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          const queues: QueueData[] = [];
          querySnapshot.forEach((doc) => {
            const queue = { id: doc.id, ...doc.data() } as Queue;
            queues.push(convertQueueToData(queue));
          });
          callback(queues);
        },
        (error) => {
          console.error('타임슬롯 대기열 실시간 구독 오류:', error);
          onError?.(new Error('실시간 대기열 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('타임슬롯 대기열 구독 설정 오류:', error);
      onError?.(new Error('대기열 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * Firebase 권한 테스트 함수 (디버깅용)
   */
  static async testFirebasePermissions(queueId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('QueueService: testFirebasePermissions 시작 - queueId:', queueId, 'userId:', userId);
      
      const queueDoc = doc(this.queuesCollection, queueId);
      
      // 읽기 권한 테스트
      console.log('QueueService: 읽기 권한 테스트 중...');
      const readSnapshot = await getDoc(queueDoc);
      if (!readSnapshot.exists()) {
        return { success: false, message: '대기열을 찾을 수 없습니다.' };
      }
      console.log('QueueService: 읽기 권한 테스트 성공');
      
      const queue = readSnapshot.data() as Queue;
      
      // 사용자 권한 확인
      if (queue.userId !== userId) {
        return { success: false, message: '대기열을 취소할 권한이 없습니다.' };
      }
      
      // 쓰기 권한 테스트 (실제로는 업데이트하지 않고 권한만 확인)
      console.log('QueueService: 쓰기 권한 테스트 중...');
      try {
        // 실제로는 업데이트하지 않고 권한만 확인하기 위해 빈 업데이트 시도
        await updateDoc(queueDoc, {
          // 실제로는 변경하지 않는 필드
          updatedAt: getCurrentTimestamp(),
        });
        console.log('QueueService: 쓰기 권한 테스트 성공');
        return { success: true, message: 'Firebase 권한이 정상입니다.' };
      } catch (writeError) {
        console.error('QueueService: 쓰기 권한 테스트 실패:', writeError);
        return { 
          success: false, 
          message: `Firebase 쓰기 권한 오류: ${writeError instanceof Error ? writeError.message : String(writeError)}` 
        };
      }
    } catch (error) {
      console.error('QueueService: testFirebasePermissions 오류:', error);
      return { 
        success: false, 
        message: `권한 테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 대기열 취소 테스트 함수 (디버깅용)
   */
  static async testCancelQueue(queueId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('QueueService: testCancelQueue 시작 - queueId:', queueId, 'userId:', userId);
      
      // 1. 대기열 존재 여부 확인
      const queueDoc = doc(this.queuesCollection, queueId);
      const queueSnapshot = await getDoc(queueDoc);
      
      if (!queueSnapshot.exists()) {
        return { success: false, message: '대기열을 찾을 수 없습니다.' };
      }
      
      const queue = queueSnapshot.data() as Queue;
      console.log('QueueService: 테스트 - 대기열 정보:', {
        id: queueId,
        status: queue.status,
        userId: queue.userId,
        eventId: queue.eventId,
        timeSlotId: queue.timeSlotId
      });
      
      // 2. 사용자 권한 확인
      if (queue.userId !== userId) {
        return { success: false, message: '대기열을 취소할 권한이 없습니다.' };
      }
      
      // 3. 대기열 상태 확인
      if (queue.status === 'cancelled') {
        return { success: false, message: '이미 취소된 대기열입니다.' };
      }
      
      return { success: true, message: '대기열 취소가 가능합니다.' };
    } catch (error) {
      console.error('QueueService: testCancelQueue 오류:', error);
      return { success: false, message: `테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * 예상 대기 시간을 계산합니다.
   */
  private static calculateEstimatedWaitTime(queueNumber: number): number {
    // 평균 5분/인으로 계산
    return queueNumber * 5;
  }
}
