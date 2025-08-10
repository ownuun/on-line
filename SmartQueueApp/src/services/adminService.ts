import { doc, updateDoc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from './authService';
import { ManualReviewQueue, faceRecognitionService } from './faceRecognitionService';
import { EventData, TimeSlotData, QueueData } from '../types/firestore';

export class AdminService {
  /**
   * 사용자에게 관리자 역할을 부여합니다.
   */
  static async grantAdminRole(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      
      // 현재 사용자 정보 확인
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 관리자 역할 추가
      await updateDoc(userRef, {
        role: 'admin',
        updatedAt: new Date()
      });

      console.log(`사용자 ${userId}에게 관리자 역할이 부여되었습니다.`);
      return true;
    } catch (error) {
      console.error('관리자 역할 부여 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자의 관리자 권한을 확인합니다.
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data() as UserProfile;
      return userData.role === 'admin';
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error);
      return false;
    }
  }

  /**
   * 현재 사용자가 관리자인지 확인합니다.
   */
  static async checkCurrentUserAdminRole(): Promise<boolean> {
    try {
      // Firebase Auth에서 현재 사용자 ID 가져오기
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        return false;
      }

      return await this.isAdmin(currentUser.uid);
    } catch (error) {
      console.error('현재 사용자 관리자 권한 확인 오류:', error);
      return false;
    }
  }

  /**
   * 수동 검수 대기열 조회
   */
  static async getManualReviewQueue(): Promise<ManualReviewQueue[]> {
    try {
      return await faceRecognitionService.getManualReviewQueue();
    } catch (error) {
      console.error('수동 검수 대기열 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 수동 검수 결과 업데이트
   */
  static async updateManualReview(
    reviewId: string,
    status: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<void> {
    try {
      await faceRecognitionService.updateManualReview(reviewId, status, reviewedBy);
    } catch (error) {
      console.error('수동 검수 결과 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 얼굴 인식 통계 조회
   */
  static async getFaceRecognitionStats(): Promise<{
    totalAttempts: number;
    successfulMatches: number;
    failedMatches: number;
    pendingReviews: number;
    successRate: number;
  }> {
    try {
      // 얼굴 인식 결과 통계
      const recognitionResultsRef = collection(db, 'faceRecognitionResults');
      const recognitionQuery = query(recognitionResultsRef);
      const recognitionSnapshot = await getDocs(recognitionQuery);
      
      let totalAttempts = 0;
      let successfulMatches = 0;
      let failedMatches = 0;

      recognitionSnapshot.forEach((doc) => {
        const data = doc.data();
        totalAttempts++;
        if (data.isMatch) {
          successfulMatches++;
        } else {
          failedMatches++;
        }
      });

      // 수동 검수 대기열 통계
      const pendingReviews = await this.getPendingReviewCount();

      const successRate = totalAttempts > 0 ? (successfulMatches / totalAttempts) * 100 : 0;

      return {
        totalAttempts,
        successfulMatches,
        failedMatches,
        pendingReviews,
        successRate,
      };
    } catch (error) {
      console.error('얼굴 인식 통계 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 대기 중인 수동 검수 개수 조회
   */
  private static async getPendingReviewCount(): Promise<number> {
    try {
      const reviewQueueRef = collection(db, 'manualReviewQueue');
      const pendingQuery = query(reviewQueueRef, where('status', '==', 'pending'));
      const pendingSnapshot = await getDocs(pendingQuery);
      return pendingSnapshot.size;
    } catch (error) {
      console.error('대기 중인 검수 개수 조회 오류:', error);
      return 0;
    }
  }

  // ==================== TO 관리 기능 ====================

  /**
   * 타임슬롯 TO 설정 업데이트
   */
  static async updateTimeSlotCapacity(
    timeSlotId: string,
    maxCapacity: number
  ): Promise<void> {
    try {
      const timeSlotRef = doc(db, 'timeSlots', timeSlotId);
      await updateDoc(timeSlotRef, {
        maxCapacity,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('타임슬롯 TO 설정 업데이트 오류:', error);
      throw new Error('TO 설정을 업데이트하는데 실패했습니다.');
    }
  }

  /**
   * 이벤트의 모든 타임슬롯 TO 설정 업데이트
   */
  static async updateEventTimeSlotsCapacity(
    eventId: string,
    timeSlotCapacities: { timeSlotId: string; maxCapacity: number }[]
  ): Promise<void> {
    try {
      const updatePromises = timeSlotCapacities.map(({ timeSlotId, maxCapacity }) =>
        this.updateTimeSlotCapacity(timeSlotId, maxCapacity)
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('이벤트 타임슬롯 TO 설정 업데이트 오류:', error);
      throw new Error('TO 설정을 업데이트하는데 실패했습니다.');
    }
  }

  /**
   * 타임슬롯 실시간 모니터링 구독
   */
  static subscribeToTimeSlotMonitoring(
    timeSlotId: string,
    callback: (data: {
      currentCount: number;
      maxCapacity: number;
      status: string;
      estimatedWaitTime: number;
    }) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const timeSlotRef = doc(db, 'timeSlots', timeSlotId);
      
      return onSnapshot(
        timeSlotRef,
        (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            callback({
              currentCount: data.currentCount || 0,
              maxCapacity: data.maxCapacity || 0,
              status: data.status || 'available',
              estimatedWaitTime: this.calculateEstimatedWaitTime(data.currentCount || 0),
            });
          }
        },
        (error) => {
          console.error('타임슬롯 모니터링 오류:', error);
          onError?.(error);
        }
      );
    } catch (error) {
      console.error('타임슬롯 모니터링 구독 오류:', error);
      onError?.(error as Error);
      return () => {};
    }
  }

  /**
   * 이벤트 전체 실시간 모니터링 구독
   */
  static subscribeToEventMonitoring(
    eventId: string,
    callback: (data: {
      totalQueued: number;
      totalCalled: number;
      totalEntered: number;
      timeSlotStats: Array<{
        timeSlotId: string;
        currentCount: number;
        maxCapacity: number;
        status: string;
      }>;
    }) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const timeSlotsQuery = query(
        collection(db, 'timeSlots'),
        where('eventId', '==', eventId)
      );

      return onSnapshot(
        timeSlotsQuery,
        async (snapshot) => {
          const timeSlotStats: Array<{
            timeSlotId: string;
            currentCount: number;
            maxCapacity: number;
            status: string;
          }> = [];

          let totalQueued = 0;
          let totalCalled = 0;
          let totalEntered = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            timeSlotStats.push({
              timeSlotId: doc.id,
              currentCount: data.currentCount || 0,
              maxCapacity: data.maxCapacity || 0,
              status: data.status || 'available',
            });
            totalQueued += data.currentCount || 0;
          });

          // 큐 상태 통계 계산
          const queueStats = await this.getQueueStatsByEvent(eventId);
          totalCalled = queueStats.calledCount;
          totalEntered = queueStats.enteredCount;

          callback({
            totalQueued,
            totalCalled,
            totalEntered,
            timeSlotStats,
          });
        },
        (error) => {
          console.error('이벤트 모니터링 오류:', error);
          onError?.(error);
        }
      );
    } catch (error) {
      console.error('이벤트 모니터링 구독 오류:', error);
      onError?.(error as Error);
      return () => {};
    }
  }

  /**
   * 큐 통계 조회
   */
  private static async getQueueStatsByEvent(eventId: string): Promise<{
    calledCount: number;
    enteredCount: number;
  }> {
    try {
      const queuesQuery = query(
        collection(db, 'queues'),
        where('eventId', '==', eventId)
      );
      
      const snapshot = await getDocs(queuesQuery);
      let calledCount = 0;
      let enteredCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'called') calledCount++;
        if (data.status === 'entered') enteredCount++;
      });

      return { calledCount, enteredCount };
    } catch (error) {
      console.error('큐 통계 조회 오류:', error);
      return { calledCount: 0, enteredCount: 0 };
    }
  }

  /**
   * 예상 대기 시간 계산
   */
  private static calculateEstimatedWaitTime(currentCount: number): number {
    // 평균 처리 시간: 2분
    const averageProcessingTime = 2;
    return currentCount * averageProcessingTime;
  }

  // ==================== 호출 관리 기능 ====================

  /**
   * 다음 대기자 호출
   */
  static async callNextPerson(timeSlotId: string): Promise<boolean> {
    try {
      // 대기 중인 첫 번째 사용자 찾기
      const queuesQuery = query(
        collection(db, 'queues'),
        where('timeSlotId', '==', timeSlotId),
        where('status', '==', 'waiting'),
        orderBy('queueNumber', 'asc'),
        limit(1)
      );

      const snapshot = await getDocs(queuesQuery);
      
      if (snapshot.empty) {
        return false; // 대기 중인 사용자가 없음
      }

      const queueDoc = snapshot.docs[0];
      const queueData = queueDoc.data();

      // 상태를 'called'로 업데이트
      await updateDoc(doc(db, 'queues', queueDoc.id), {
        status: 'called',
        calledAt: new Date(),
        updatedAt: new Date(),
      });

      // 타임슬롯 현재 인원 수 감소
      const timeSlotRef = doc(db, 'timeSlots', timeSlotId);
      const timeSlotDoc = await getDoc(timeSlotRef);
      
      if (timeSlotDoc.exists()) {
        const currentCount = timeSlotDoc.data().currentCount || 0;
        await updateDoc(timeSlotRef, {
          currentCount: Math.max(0, currentCount - 1),
          updatedAt: new Date(),
        });
      }

      return true;
    } catch (error) {
      console.error('다음 대기자 호출 오류:', error);
      throw new Error('다음 대기자를 호출하는데 실패했습니다.');
    }
  }

  /**
   * 호출된 사용자 입장 처리
   */
  static async markPersonEntered(queueId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'queues', queueId), {
        status: 'entered',
        enteredAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('입장 처리 오류:', error);
      throw new Error('입장 처리를 하는데 실패했습니다.');
    }
  }

  /**
   * 전체 통계 조회
   */
  static async getOverallStats(): Promise<{
    totalEvents: number;
    activeEvents: number;
    totalQueued: number;
    totalCalled: number;
    totalEntered: number;
    faceRecognitionStats: {
      totalAttempts: number;
      successfulMatches: number;
      failedMatches: number;
      pendingReviews: number;
      successRate: number;
    };
  }> {
    try {
      // 이벤트 통계
      const eventsQuery = query(collection(db, 'events'));
      const eventsSnapshot = await getDocs(eventsQuery);
      const totalEvents = eventsSnapshot.size;
      
      let activeEvents = 0;
      eventsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'active') activeEvents++;
      });

      // 큐 통계
      const queuesQuery = query(collection(db, 'queues'));
      const queuesSnapshot = await getDocs(queuesQuery);
      
      let totalQueued = 0;
      let totalCalled = 0;
      let totalEntered = 0;

      queuesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'waiting') totalQueued++;
        if (data.status === 'called') totalCalled++;
        if (data.status === 'entered') totalEntered++;
      });

      // 얼굴 인식 통계
      const faceRecognitionStats = await this.getFaceRecognitionStats();

      return {
        totalEvents,
        activeEvents,
        totalQueued,
        totalCalled,
        totalEntered,
        faceRecognitionStats,
      };
    } catch (error) {
      console.error('전체 통계 조회 오류:', error);
      throw new Error('통계를 불러오는데 실패했습니다.');
    }
  }
}
