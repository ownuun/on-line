import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  StorageReference,
} from 'firebase/storage';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { faceRecognitionService, FaceRecognitionResult } from './faceRecognitionService';

// 티켓 정보 인터페이스
export interface TicketInfo {
  id: string;
  userId: string;
  eventId: string;
  timeSlotId: string;
  ticketImageUrl: string;
  ticketType: string;
  ticketNumber: string;
  isValid: boolean;
  faceRecognitionResult?: FaceRecognitionResult;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 업로드 결과 인터페이스
export interface UploadResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

// 이미지 검증 결과 인터페이스
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class TicketService {
  private static ticketsCollection = collection(db, 'tickets');
  private static maxFileSize = 10 * 1024 * 1024; // 10MB
  private static allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

  /**
   * 이미지 선택 및 업로드
   */
  static async uploadTicketImage(
    userId: string,
    eventId: string,
    timeSlotId: string
  ): Promise<UploadResult> {
    try {
      // 1. 이미지 선택
      const imageResult = await this.pickImage();
      if (!imageResult.success) {
        return { success: false, error: imageResult.error };
      }

      // 2. 이미지 검증
      const validation = this.validateImage(imageResult.uri, imageResult.type);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      // 3. Firebase Storage에 업로드
      const fileName = `tickets/${userId}/${eventId}_${timeSlotId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      const response = await fetch(imageResult.uri);
      const blob = await response.blob();
      
      const uploadResult = await uploadBytes(storageRef, blob);
      
      // 4. 다운로드 URL 가져오기
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // 5. Firestore에 티켓 정보 저장
      const ticketData: Partial<TicketInfo> = {
        userId,
        eventId,
        timeSlotId,
        ticketImageUrl: downloadUrl,
        ticketType: 'general', // 기본값
        ticketNumber: this.generateTicketNumber(),
        isValid: false, // 검증 전까지는 false
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ticketRef = doc(this.ticketsCollection);
      await setDoc(ticketRef, ticketData);

      return {
        success: true,
        downloadUrl,
      };
    } catch (error) {
      console.error('티켓 이미지 업로드 오류:', error);
      return {
        success: false,
        error: '티켓 이미지 업로드에 실패했습니다.',
      };
    }
  }

  /**
   * 이미지 선택
   */
  private static async pickImage(): Promise<{
    success: boolean;
    uri?: string;
    type?: string;
    error?: string;
  }> {
    try {
      // 권한 요청
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        return {
          success: false,
          error: '갤러리 접근 권한이 필요합니다.',
        };
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return {
          success: true,
          uri: result.assets[0].uri,
          type: result.assets[0].type || 'image/jpeg',
        };
      } else {
        return {
          success: false,
          error: '이미지 선택이 취소되었습니다.',
        };
      }
    } catch (error) {
      console.error('이미지 선택 오류:', error);
      return {
        success: false,
        error: '이미지 선택 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 이미지 검증
   */
  private static validateImage(uri: string, type: string): ValidationResult {
    const errors: string[] = [];

    // 파일 타입 검증
    if (!this.allowedTypes.includes(type)) {
      errors.push('지원되지 않는 이미지 형식입니다. (JPEG, PNG만 지원)');
    }

    // 파일 크기 검증 (실제로는 업로드 후 확인)
    // 여기서는 기본 검증만 수행

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 티켓 번호 생성
   */
  private static generateTicketNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `TKT-${timestamp.slice(-6)}-${random.toUpperCase()}`;
  }

  /**
   * 사용자의 티켓 정보 조회
   */
  static async getUserTicket(userId: string): Promise<TicketInfo | null> {
    try {
      const q = query(
        this.ticketsCollection,
        where('userId', '==', userId),
        where('isValid', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const ticketDoc = querySnapshot.docs[0];
      return { id: ticketDoc.id, ...ticketDoc.data() } as TicketInfo;
    } catch (error) {
      console.error('사용자 티켓 조회 오류:', error);
      throw new Error('티켓 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 이벤트의 티켓 정보 조회
   */
  static async getEventTickets(eventId: string): Promise<TicketInfo[]> {
    try {
      const q = query(
        this.ticketsCollection,
        where('eventId', '==', eventId),
        where('isValid', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const tickets: TicketInfo[] = [];
      
      querySnapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() } as TicketInfo);
      });
      
      return tickets;
    } catch (error) {
      console.error('이벤트 티켓 조회 오류:', error);
      throw new Error('이벤트 티켓 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 티켓 검증 상태 업데이트 (관리자용)
   */
  static async updateTicketValidation(
    ticketId: string,
    isValid: boolean,
    verifiedBy: string
  ): Promise<void> {
    try {
      const ticketRef = doc(this.ticketsCollection, ticketId);
      const updateData: Partial<TicketInfo> = {
        isValid,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      };
      
      await updateDoc(ticketRef, updateData);
    } catch (error) {
      console.error('티켓 검증 업데이트 오류:', error);
      throw new Error('티켓 검증 상태를 업데이트하는데 실패했습니다.');
    }
  }

  /**
   * 얼굴 인식 기반 티켓 검증
   */
  static async verifyTicketWithFaceRecognition(
    userId: string,
    ticketId: string,
    eventId: string
  ): Promise<FaceRecognitionResult> {
    try {
      // 1. 얼굴 인식 수행
      const recognitionResult = await faceRecognitionService.compareFaces(
        userId,
        ticketId,
        eventId
      );

      // 2. 티켓 정보 업데이트
      const ticketRef = doc(this.ticketsCollection, ticketId);
      const updateData: Partial<TicketInfo> = {
        faceRecognitionResult: recognitionResult,
        isValid: recognitionResult.isMatch,
        verifiedAt: recognitionResult.isMatch ? new Date() : undefined,
        updatedAt: new Date(),
      };

      await updateDoc(ticketRef, updateData);

      return recognitionResult;
    } catch (error) {
      console.error('얼굴 인식 티켓 검증 오류:', error);
      throw new Error('얼굴 인식 검증에 실패했습니다.');
    }
  }

  /**
   * 얼굴 인식 실패한 티켓 목록 조회
   */
  static async getFaceRecognitionFailedTickets(): Promise<TicketInfo[]> {
    try {
      const q = query(
        this.ticketsCollection,
        where('faceRecognitionResult.isMatch', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const tickets: TicketInfo[] = [];
      
      querySnapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() } as TicketInfo);
      });
      
      return tickets;
    } catch (error) {
      console.error('얼굴 인식 실패 티켓 조회 오류:', error);
      throw new Error('얼굴 인식 실패 티켓을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 티켓 이미지 삭제
   */
  static async deleteTicketImage(ticketId: string): Promise<void> {
    try {
      // 1. 티켓 정보 조회
      const ticketRef = doc(this.ticketsCollection, ticketId);
      const ticketSnapshot = await getDoc(ticketRef);
      
      if (!ticketSnapshot.exists()) {
        throw new Error('티켓을 찾을 수 없습니다.');
      }
      
      const ticket = ticketSnapshot.data() as TicketInfo;
      
      // 2. Storage에서 이미지 삭제
      if (ticket.ticketImageUrl) {
        const imageRef = ref(storage, ticket.ticketImageUrl);
        await deleteObject(imageRef);
      }
      
      // 3. Firestore에서 티켓 정보 삭제
      await deleteDoc(ticketRef);
    } catch (error) {
      console.error('티켓 이미지 삭제 오류:', error);
      throw new Error('티켓 이미지를 삭제하는데 실패했습니다.');
    }
  }

  /**
   * 티켓 정보 업데이트
   */
  static async updateTicketInfo(
    ticketId: string,
    updates: Partial<TicketInfo>
  ): Promise<void> {
    try {
      const ticketRef = doc(this.ticketsCollection, ticketId);
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };
      
      await updateDoc(ticketRef, updateData);
    } catch (error) {
      console.error('티켓 정보 업데이트 오류:', error);
      throw new Error('티켓 정보를 업데이트하는데 실패했습니다.');
    }
  }
}
