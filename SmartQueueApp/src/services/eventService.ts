import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Event,
  TimeSlot,
  EventData,
  TimeSlotData,
  TimeSlotSummary,
} from '../types/firestore';
import {
  convertEventToData,
  convertTimeSlotToData,
  getCurrentTimestamp,
} from '../utils/firestoreUtils';

export class EventService {
  private static eventsCollection = collection(db, 'events');
  private static timeSlotsCollection = collection(db, 'timeSlots');

  /**
   * 모든 활성 이벤트 목록을 조회합니다.
   */
  static async getActiveEvents(): Promise<EventData[]> {
    try {
      // 현재 날짜 기준으로 미래의 이벤트만 조회
      const now = new Date();
      const q = query(
        this.eventsCollection,
        where('date', '>=', now),
        orderBy('date', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const events: EventData[] = [];
      
      querySnapshot.forEach((doc) => {
        const event = { id: doc.id, ...doc.data() } as Event;
        events.push(convertEventToData(event));
      });
      
      return events;
    } catch (error) {
      console.error('이벤트 목록 조회 오류:', error);
      throw new Error('이벤트 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 모든 이벤트 목록을 조회합니다 (관리자용).
   */
  static async getAllEvents(): Promise<EventData[]> {
    try {
      const q = query(
        this.eventsCollection,
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const events: EventData[] = [];
      
      querySnapshot.forEach((doc) => {
        const event = { id: doc.id, ...doc.data() } as Event;
        events.push(convertEventToData(event));
      });
      
      return events;
    } catch (error) {
      console.error('전체 이벤트 목록 조회 오류:', error);
      throw new Error('이벤트 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 이벤트의 상세 정보를 조회합니다.
   */
  static async getEventById(eventId: string): Promise<EventData | null> {
    try {
      const eventDoc = doc(this.eventsCollection, eventId);
      const eventSnapshot = await getDoc(eventDoc);
      
      if (!eventSnapshot.exists()) {
        return null;
      }
      
      const event = { id: eventSnapshot.id, ...eventSnapshot.data() } as Event;
      return convertEventToData(event);
    } catch (error) {
      console.error('이벤트 조회 오류:', error);
      throw new Error('이벤트 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 타임슬롯 정보를 조회합니다.
   */
  static async getTimeSlotById(timeSlotId: string): Promise<TimeSlotData | null> {
    try {
      const timeSlotDoc = doc(this.timeSlotsCollection, timeSlotId);
      const timeSlotSnapshot = await getDoc(timeSlotDoc);
      
      if (!timeSlotSnapshot.exists()) {
        return null;
      }
      
      const timeSlot = { id: timeSlotSnapshot.id, ...timeSlotSnapshot.data() } as TimeSlot;
      return convertTimeSlotToData(timeSlot);
    } catch (error) {
      console.error('타임슬롯 조회 오류:', error);
      throw new Error('타임슬롯 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 이벤트의 타임슬롯 목록을 조회합니다.
   */
  static async getTimeSlotsByEventId(eventId: string): Promise<TimeSlotData[]> {
    try {
      console.log('EventService: 타임슬롯 조회 시작 - 이벤트 ID:', eventId);
      
      // 임시로 orderBy를 제거하여 인덱스 없이도 작동하도록 수정
      const q = query(
        this.timeSlotsCollection,
        where('eventId', '==', eventId)
      );
      
      console.log('EventService: 쿼리 생성 완료 (orderBy 제거됨)');
      const querySnapshot = await getDocs(q);
      console.log('EventService: 쿼리 결과 - 문서 수:', querySnapshot.docs.length);
      
      const timeSlots: TimeSlotData[] = [];
      
      querySnapshot.forEach((doc) => {
        console.log('EventService: 타임슬롯 문서 데이터:', doc.id, doc.data());
        const timeSlot = { id: doc.id, ...doc.data() } as TimeSlot;
        const convertedTimeSlot = convertTimeSlotToData(timeSlot);
        console.log('EventService: 변환된 타임슬롯:', convertedTimeSlot);
        timeSlots.push(convertedTimeSlot);
      });
      
      // 클라이언트에서 정렬
      timeSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      console.log('EventService: 최종 타임슬롯 목록 (정렬됨):', timeSlots);
      return timeSlots;
    } catch (error) {
      console.error('EventService: 타임슬롯 조회 오류:', error);
      throw new Error('타임슬롯 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 타임슬롯의 현재 상태 요약을 계산합니다.
   */
  static calculateTimeSlotSummary(timeSlot: TimeSlotData): TimeSlotSummary {
    const availableCount = Math.max(0, timeSlot.maxCapacity - timeSlot.currentCount);
    const isFull = timeSlot.currentCount >= timeSlot.maxCapacity;
    const isClosed = timeSlot.status === 'closed';
    
    return {
      timeSlotId: timeSlot.id,
      currentCount: timeSlot.currentCount,
      availableCount,
      isFull,
      isClosed,
    };
  }

  /**
   * 실시간으로 이벤트 목록을 구독합니다.
   */
  static subscribeToActiveEvents(
    callback: (events: EventData[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.eventsCollection,
        where('status', 'in', ['upcoming', 'active']),
        orderBy('date', 'asc')
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          const events: EventData[] = [];
          querySnapshot.forEach((doc) => {
            const event = { id: doc.id, ...doc.data() } as Event;
            events.push(convertEventToData(event));
          });
          callback(events);
        },
        (error) => {
          console.error('이벤트 실시간 구독 오류:', error);
          onError?.(new Error('실시간 이벤트 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('이벤트 구독 설정 오류:', error);
      onError?.(new Error('이벤트 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 실시간으로 특정 이벤트의 타임슬롯을 구독합니다.
   */
  static subscribeToEventTimeSlots(
    eventId: string,
    callback: (timeSlots: TimeSlotData[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        this.timeSlotsCollection,
        where('eventId', '==', eventId),
        orderBy('startTime', 'asc')
      );
      
      return onSnapshot(
        q,
        (querySnapshot) => {
          const timeSlots: TimeSlotData[] = [];
          querySnapshot.forEach((doc) => {
            const timeSlot = { id: doc.id, ...doc.data() } as TimeSlot;
            timeSlots.push(convertTimeSlotToData(timeSlot));
          });
          callback(timeSlots);
        },
        (error) => {
          console.error('타임슬롯 실시간 구독 오류:', error);
          onError?.(new Error('실시간 타임슬롯 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('타임슬롯 구독 설정 오류:', error);
      onError?.(new Error('타임슬롯 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 특정 타임슬롯의 실시간 상태를 구독합니다.
   */
  static subscribeToTimeSlot(
    timeSlotId: string,
    callback: (timeSlot: TimeSlotData | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    try {
      const timeSlotDoc = doc(this.timeSlotsCollection, timeSlotId);
      
      return onSnapshot(
        timeSlotDoc,
        (docSnapshot) => {
          if (!docSnapshot.exists()) {
            callback(null);
            return;
          }
          
          const timeSlot = { id: docSnapshot.id, ...docSnapshot.data() } as TimeSlot;
          callback(convertTimeSlotToData(timeSlot));
        },
        (error) => {
          console.error('타임슬롯 실시간 구독 오류:', error);
          onError?.(new Error('실시간 타임슬롯 업데이트에 실패했습니다.'));
        }
      );
    } catch (error) {
      console.error('타임슬롯 구독 설정 오류:', error);
      onError?.(new Error('타임슬롯 구독을 설정하는데 실패했습니다.'));
      return () => {};
    }
  }

  /**
   * 이벤트가 현재 활성 상태인지 확인합니다.
   */
  static isEventActive(event: EventData): boolean {
    const now = new Date();
    const eventDate = new Date(event.date);
    
    // 이벤트 날짜가 오늘이고 상태가 active인 경우
    return event.status === 'active' && 
           eventDate.toDateString() === now.toDateString();
  }

  /**
   * 타임슬롯이 현재 사용 가능한지 확인합니다.
   */
  static isTimeSlotAvailable(timeSlot: TimeSlotData): boolean {
    return timeSlot.status === 'available' && 
           timeSlot.currentCount < timeSlot.maxCapacity;
  }

  /**
   * 타임슬롯의 잔여 TO 수를 계산합니다.
   */
  static getAvailableCapacity(timeSlot: TimeSlotData): number {
    return Math.max(0, timeSlot.maxCapacity - timeSlot.currentCount);
  }

  /**
   * 관리자용 이벤트 생성
   */
  static async createEvent(
    eventData: {
      name: string;
      description: string;
      date: Date;
      location: string;
      maxCapacity: number;
      timeSlots: Array<{
        startTime: string;
        endTime: string;
        maxCapacity: number;
      }>;
    },
    createdBy: string
  ): Promise<string> {
    try {
      // 1. 이벤트 생성
      const eventDoc = await addDoc(this.eventsCollection, {
        name: eventData.name,
        description: eventData.description,
        date: eventData.date,
        location: eventData.location,
        maxCapacity: eventData.maxCapacity,
        status: 'upcoming',
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 2. 타임슬롯 생성
      const timeSlotPromises = eventData.timeSlots.map(timeSlot =>
        addDoc(this.timeSlotsCollection, {
          eventId: eventDoc.id,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          status: 'available',
          maxCapacity: timeSlot.maxCapacity,
          currentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      await Promise.all(timeSlotPromises);

      console.log('이벤트가 성공적으로 생성되었습니다:', eventDoc.id);
      return eventDoc.id;
    } catch (error) {
      console.error('이벤트 생성 오류:', error);
      throw new Error('이벤트 생성에 실패했습니다.');
    }
  }

  /**
   * 이벤트 수정
   */
  static async updateEvent(
    eventId: string,
    updateData: Partial<{
      name: string;
      description: string;
      date: Date;
      location: string;
      maxCapacity: number;
      status: 'upcoming' | 'active' | 'completed' | 'cancelled';
    }>
  ): Promise<void> {
    try {
      const eventRef = doc(this.eventsCollection, eventId);
      await updateDoc(eventRef, {
        ...updateData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('이벤트 수정 오류:', error);
      throw new Error('이벤트 수정에 실패했습니다.');
    }
  }

  /**
   * 이벤트 삭제
   */
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      console.log('이벤트 삭제 시작:', eventId);
      
      // 1. 이벤트 존재 확인
      const eventRef = doc(this.eventsCollection, eventId);
      const eventSnapshot = await getDoc(eventRef);
      
      if (!eventSnapshot.exists()) {
        throw new Error('삭제할 이벤트를 찾을 수 없습니다.');
      }
      
      console.log('이벤트 확인됨:', eventSnapshot.data().name);
      
      // 2. 관련 타임슬롯 조회
      console.log('타임슬롯 조회 중...');
      const timeSlotsQuery = query(
        this.timeSlotsCollection,
        where('eventId', '==', eventId)
      );
      const timeSlotsSnapshot = await getDocs(timeSlotsQuery);
      console.log('찾은 타임슬롯 수:', timeSlotsSnapshot.docs.length);
      
      // 3. 타임슬롯 삭제 (실패해도 계속 진행)
      if (timeSlotsSnapshot.docs.length > 0) {
        console.log('타임슬롯 삭제 중...');
        const deleteTimeSlotPromises = timeSlotsSnapshot.docs.map(async (doc) => {
          try {
            console.log('타임슬롯 삭제:', doc.id);
            await deleteDoc(doc.ref);
            console.log('타임슬롯 삭제 성공:', doc.id);
          } catch (error) {
            console.error('타임슬롯 삭제 실패:', doc.id, error);
            // 개별 타임슬롯 삭제 실패는 전체 프로세스를 중단하지 않음
          }
        });
        
        try {
          await Promise.all(deleteTimeSlotPromises);
          console.log('타임슬롯 삭제 완료');
        } catch (error) {
          console.warn('일부 타임슬롯 삭제 실패, 이벤트 삭제는 계속 진행:', error);
        }
      } else {
        console.log('삭제할 타임슬롯이 없습니다');
      }

      // 4. 이벤트 삭제
      console.log('이벤트 삭제 중...');
      await deleteDoc(eventRef);
      console.log('이벤트 삭제 완료:', eventId);
      
    } catch (error) {
      console.error('이벤트 삭제 오류:', error);
      console.error('오류 상세 정보:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '이벤트 삭제에 실패했습니다.';
      
      if (error.code === 'permission-denied') {
        errorMessage = '삭제 권한이 없습니다. 관리자 권한을 확인해주세요.';
      } else if (error.code === 'not-found') {
        errorMessage = '삭제할 이벤트를 찾을 수 없습니다.';
      } else if (error.code === 'unavailable') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (error.message) {
        errorMessage = `이벤트 삭제에 실패했습니다: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }
}
