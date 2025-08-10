import { Timestamp } from 'firebase/firestore';

// 이벤트 인터페이스
export interface Event {
  id: string;
  name: string;
  description: string;
  date: Timestamp;
  location: string;
  maxCapacity: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 타임슬롯 인터페이스
export interface TimeSlot {
  id: string;
  eventId: string;
  startTime: string; // HH:mm 형식
  endTime: string; // HH:mm 형식
  maxCapacity: number;
  currentCount: number;
  status: 'available' | 'full' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 대기열 인터페이스
export interface Queue {
  id: string;
  eventId: string;
  timeSlotId: string;
  userId: string;
  queueNumber: number;
  status: 'waiting' | 'called' | 'entered' | 'cancelled';
  estimatedWaitTime?: number; // 분 단위
  createdAt: Timestamp;
  updatedAt: Timestamp;
  calledAt?: Timestamp;
  enteredAt?: Timestamp;
}

// 대기열 항목 인터페이스 (서브컬렉션)
export interface QueueEntry {
  id: string;
  queueId: string;
  userId: string;
  queueNumber: number;
  status: 'waiting' | 'called' | 'entered' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  calledAt?: Timestamp;
  enteredAt?: Timestamp;
}

// 알림 인터페이스
export interface Notification {
  id: string;
  userId: string;
  type: 'queue_call' | 'reminder' | 'queue_update' | 'event_update';
  title: string;
  message: string;
  isRead: boolean;
  eventId?: string;
  queueId?: string;
  createdAt: Timestamp;
  readAt?: Timestamp;
}

// 얼굴 인식 결과 인터페이스
export interface FaceRecognitionResult {
  id: string;
  userId: string;
  ticketId: string;
  eventId: string;
  confidence: number;
  isMatch: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 수동 검수 대기열 인터페이스
export interface ManualReviewQueue {
  id: string;
  userId: string;
  eventId: string;
  ticketId: string;
  profileImageUrl: string;
  ticketImageUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  confidence: number;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 티켓 인터페이스
export interface Ticket {
  id: string;
  userId: string;
  eventId: string;
  ticketNumber: string;
  ticketImageUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  faceRecognitionResult?: FaceRecognitionResult;
  verifiedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

// Firestore 문서 데이터 인터페이스 (타임스탬프를 Date로 변환)
export interface EventData extends Omit<Event, 'date' | 'createdAt' | 'updatedAt'> {
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlotData extends Omit<TimeSlot, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueData extends Omit<Queue, 'createdAt' | 'updatedAt' | 'calledAt' | 'enteredAt'> {
  createdAt: Date;
  updatedAt: Date;
  calledAt?: Date;
  enteredAt?: Date;
}

export interface QueueEntryData extends Omit<QueueEntry, 'createdAt' | 'updatedAt' | 'calledAt' | 'enteredAt'> {
  createdAt: Date;
  updatedAt: Date;
  calledAt?: Date;
  enteredAt?: Date;
}

export interface NotificationData extends Omit<Notification, 'createdAt' | 'readAt'> {
  createdAt: Date;
  readAt?: Date;
}

export interface FaceRecognitionResultData extends Omit<FaceRecognitionResult, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

export interface ManualReviewQueueData extends Omit<ManualReviewQueue, 'reviewedAt' | 'createdAt' | 'updatedAt'> {
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketData extends Omit<Ticket, 'verifiedAt' | 'createdAt' | 'updatedAt'> {
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserData extends Omit<User, 'createdAt' | 'updatedAt' | 'lastLoginAt'> {
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// 대기열 상태 요약 인터페이스
export interface QueueSummary {
  eventId: string;
  timeSlotId: string;
  totalCount: number;
  waitingCount: number;
  calledCount: number;
  enteredCount: number;
  estimatedWaitTime: number; // 분 단위
}

// 타임슬롯 상태 요약 인터페이스
export interface TimeSlotSummary {
  timeSlotId: string;
  currentCount: number;
  availableCount: number;
  isFull: boolean;
  isClosed: boolean;
}
