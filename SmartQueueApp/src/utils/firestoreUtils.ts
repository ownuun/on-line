import { Timestamp } from 'firebase/firestore';
import {
  Event,
  TimeSlot,
  Queue,
  QueueEntry,
  Notification,
  Ticket,
  User,
  EventData,
  TimeSlotData,
  QueueData,
  QueueEntryData,
  NotificationData,
  TicketData,
  UserData,
} from '../types/firestore';

// Timestamp를 Date로 변환하는 헬퍼 함수
export const timestampToDate = (timestamp: Timestamp | null | undefined): Date | null => {
  if (!timestamp) return null;
  return timestamp.toDate();
};

// Date를 Timestamp로 변환하는 헬퍼 함수
export const dateToTimestamp = (date: Date | null | undefined): Timestamp | null => {
  if (!date) return null;
  return Timestamp.fromDate(date);
};

// Firestore 문서를 클라이언트 데이터로 변환하는 함수들
export const convertEventToData = (event: Event): EventData => ({
  ...event,
  date: timestampToDate(event.date)!,
  createdAt: timestampToDate(event.createdAt)!,
  updatedAt: timestampToDate(event.updatedAt)!,
});

export const convertTimeSlotToData = (timeSlot: TimeSlot): TimeSlotData => ({
  ...timeSlot,
  createdAt: timestampToDate(timeSlot.createdAt)!,
  updatedAt: timestampToDate(timeSlot.updatedAt)!,
});

export const convertQueueToData = (queue: Queue): QueueData => ({
  ...queue,
  createdAt: timestampToDate(queue.createdAt)!,
  updatedAt: timestampToDate(queue.updatedAt)!,
  calledAt: timestampToDate(queue.calledAt),
  enteredAt: timestampToDate(queue.enteredAt),
});

export const convertQueueEntryToData = (entry: QueueEntry): QueueEntryData => ({
  ...entry,
  createdAt: timestampToDate(entry.createdAt)!,
  updatedAt: timestampToDate(entry.updatedAt)!,
  calledAt: timestampToDate(entry.calledAt),
  enteredAt: timestampToDate(entry.enteredAt),
});

export const convertNotificationToData = (notification: Notification): NotificationData => ({
  ...notification,
  createdAt: timestampToDate(notification.createdAt)!,
  readAt: timestampToDate(notification.readAt),
});

export const convertTicketToData = (ticket: Ticket): TicketData => ({
  ...ticket,
  verifiedAt: timestampToDate(ticket.verifiedAt),
  createdAt: timestampToDate(ticket.createdAt)!,
  updatedAt: timestampToDate(ticket.updatedAt)!,
});

export const convertUserToData = (user: User): UserData => ({
  ...user,
  createdAt: timestampToDate(user.createdAt)!,
  updatedAt: timestampToDate(user.updatedAt)!,
  lastLoginAt: timestampToDate(user.lastLoginAt),
});

// 클라이언트 데이터를 Firestore 문서로 변환하는 함수들
export const convertEventDataToFirestore = (eventData: Partial<EventData>): Partial<Event> => ({
  ...eventData,
  date: eventData.date ? dateToTimestamp(eventData.date) : undefined,
  createdAt: eventData.createdAt ? dateToTimestamp(eventData.createdAt) : undefined,
  updatedAt: eventData.updatedAt ? dateToTimestamp(eventData.updatedAt) : undefined,
});

export const convertTimeSlotDataToFirestore = (timeSlotData: Partial<TimeSlotData>): Partial<TimeSlot> => ({
  ...timeSlotData,
  createdAt: timeSlotData.createdAt ? dateToTimestamp(timeSlotData.createdAt) : undefined,
  updatedAt: timeSlotData.updatedAt ? dateToTimestamp(timeSlotData.updatedAt) : undefined,
});

export const convertQueueDataToFirestore = (queueData: Partial<QueueData>): Partial<Queue> => ({
  ...queueData,
  createdAt: queueData.createdAt ? dateToTimestamp(queueData.createdAt) : undefined,
  updatedAt: queueData.updatedAt ? dateToTimestamp(queueData.updatedAt) : undefined,
  calledAt: queueData.calledAt ? dateToTimestamp(queueData.calledAt) : undefined,
  enteredAt: queueData.enteredAt ? dateToTimestamp(queueData.enteredAt) : undefined,
});

export const convertQueueEntryDataToFirestore = (entryData: Partial<QueueEntryData>): Partial<QueueEntry> => ({
  ...entryData,
  createdAt: entryData.createdAt ? dateToTimestamp(entryData.createdAt) : undefined,
  updatedAt: entryData.updatedAt ? dateToTimestamp(entryData.updatedAt) : undefined,
  calledAt: entryData.calledAt ? dateToTimestamp(entryData.calledAt) : undefined,
  enteredAt: entryData.enteredAt ? dateToTimestamp(entryData.enteredAt) : undefined,
});

export const convertNotificationDataToFirestore = (notificationData: Partial<NotificationData>): Partial<Notification> => ({
  ...notificationData,
  createdAt: notificationData.createdAt ? dateToTimestamp(notificationData.createdAt) : undefined,
  readAt: notificationData.readAt ? dateToTimestamp(notificationData.readAt) : undefined,
});

export const convertTicketDataToFirestore = (ticketData: Partial<TicketData>): Partial<Ticket> => ({
  ...ticketData,
  verifiedAt: ticketData.verifiedAt ? dateToTimestamp(ticketData.verifiedAt) : undefined,
  createdAt: ticketData.createdAt ? dateToTimestamp(ticketData.createdAt) : undefined,
  updatedAt: ticketData.updatedAt ? dateToTimestamp(ticketData.updatedAt) : undefined,
});

export const convertUserDataToFirestore = (userData: Partial<UserData>): Partial<User> => ({
  ...userData,
  createdAt: userData.createdAt ? dateToTimestamp(userData.createdAt) : undefined,
  updatedAt: userData.updatedAt ? dateToTimestamp(userData.updatedAt) : undefined,
  lastLoginAt: userData.lastLoginAt ? dateToTimestamp(userData.lastLoginAt) : undefined,
});

// 현재 시간을 Timestamp로 반환하는 헬퍼 함수
export const getCurrentTimestamp = (): Timestamp => {
  return Timestamp.now();
};

// 현재 시간을 Date로 반환하는 헬퍼 함수
export const getCurrentDate = (): Date => {
  return new Date();
};

// 날짜 형식화 헬퍼 함수
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// 시간 형식화 헬퍼 함수
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 날짜와 시간 형식화 헬퍼 함수
export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};
