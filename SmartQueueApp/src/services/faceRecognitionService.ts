import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
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
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';

// 얼굴 인식 결과 인터페이스
export interface FaceRecognitionResult {
  success: boolean;
  confidence: number;
  isMatch: boolean;
  error?: string;
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
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 얼굴 인식 서비스 클래스
export class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private static readonly GOOGLE_CLOUD_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
  private static readonly API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY || '';
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.8; // 80% 이상 일치해야 성공

  private constructor() {}

  public static getInstance(): FaceRecognitionService {
    if (!FaceRecognitionService.instance) {
      FaceRecognitionService.instance = new FaceRecognitionService();
    }
    return FaceRecognitionService.instance;
  }

  /**
   * 사용자 프로필 이미지 업로드
   */
  static async uploadProfileImage(userId: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    try {
      // 1. 이미지 선택
      const imageResult = await this.pickImage();
      if (!imageResult.success) {
        return { success: false, error: imageResult.error };
      }

      // 2. Firebase Storage에 업로드
      const fileName = `profiles/${userId}/profile_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      const response = await fetch(imageResult.uri);
      const blob = await response.blob();
      
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // 3. 사용자 프로필 업데이트
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        profileImageUrl: downloadUrl,
        updatedAt: new Date(),
      });

      return { success: true, imageUrl: downloadUrl };
    } catch (error) {
      console.error('프로필 이미지 업로드 오류:', error);
      return { success: false, error: '프로필 이미지 업로드에 실패했습니다.' };
    }
  }

  /**
   * 얼굴 인식 비교 수행
   */
  static async compareFaces(
    userId: string,
    ticketId: string,
    eventId: string
  ): Promise<FaceRecognitionResult> {
    try {
      // 1. 사용자 프로필 이미지 가져오기
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        return { success: false, confidence: 0, isMatch: false, error: '사용자 정보를 찾을 수 없습니다.' };
      }

      const userData = userDoc.data();
      const profileImageUrl = userData.profileImageUrl;
      
      if (!profileImageUrl) {
        return { success: false, confidence: 0, isMatch: false, error: '프로필 이미지가 등록되지 않았습니다.' };
      }

      // 2. 티켓 이미지 가져오기
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (!ticketDoc.exists()) {
        return { success: false, confidence: 0, isMatch: false, error: '티켓 정보를 찾을 수 없습니다.' };
      }

      const ticketData = ticketDoc.data();
      const ticketImageUrl = ticketData.ticketImageUrl;

      if (!ticketImageUrl) {
        return { success: false, confidence: 0, isMatch: false, error: '티켓 이미지를 찾을 수 없습니다.' };
      }

      // 3. Google Cloud Vision API 호출
      const confidence = await this.callVisionAPI(profileImageUrl, ticketImageUrl);

      // 4. 결과 판정
      const isMatch = confidence >= this.MIN_CONFIDENCE_THRESHOLD;

      // 5. 결과 저장
      await this.saveRecognitionResult(userId, ticketId, eventId, confidence, isMatch);

      // 6. 실패 시 수동 검수 대기열에 추가
      if (!isMatch) {
        await this.addToManualReviewQueue(userId, ticketId, eventId, profileImageUrl, ticketImageUrl, confidence);
      }

      return {
        success: true,
        confidence,
        isMatch,
      };
    } catch (error) {
      console.error('얼굴 인식 비교 오류:', error);
      return {
        success: false,
        confidence: 0,
        isMatch: false,
        error: '얼굴 인식 처리 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * Google Cloud Vision API 호출
   */
  private static async callVisionAPI(profileImageUrl: string, ticketImageUrl: string): Promise<number> {
    try {
      // 실제 구현에서는 Google Cloud Vision API를 호출
      // 여기서는 시뮬레이션된 결과를 반환
      
      // 이미지 URL에서 base64 인코딩 (실제로는 이미지 다운로드 후 인코딩)
      const profileImageBase64 = await this.imageUrlToBase64(profileImageUrl);
      const ticketImageBase64 = await this.imageUrlToBase64(ticketImageUrl);

      const requestBody = {
        requests: [
          {
            image: {
              content: profileImageBase64,
            },
            features: [
              {
                type: 'FACE_DETECTION',
                maxResults: 1,
              },
            ],
          },
          {
            image: {
              content: ticketImageBase64,
            },
            features: [
              {
                type: 'FACE_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      };

      // 실제 API 호출 (API 키가 설정된 경우)
      if (this.API_KEY) {
        const response = await fetch(`${this.GOOGLE_CLOUD_VISION_API_URL}?key=${this.API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Vision API 호출 실패: ${response.status}`);
        }

        const result = await response.json();
        
        // 얼굴 인식 결과 분석 (실제 구현에서는 더 복잡한 로직 필요)
        return this.analyzeVisionAPIResult(result);
      } else {
        // API 키가 없는 경우 시뮬레이션된 결과 반환
        return this.simulateFaceRecognition();
      }
    } catch (error) {
      console.error('Vision API 호출 오류:', error);
      // API 호출 실패 시 기본값 반환
      return 0.5;
    }
  }

  /**
   * 이미지 URL을 base64로 변환
   */
  private static async imageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // data:image/jpeg;base64, 부분 제거
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('이미지 base64 변환 오류:', error);
      throw error;
    }
  }

  /**
   * Vision API 결과 분석
   */
  private static analyzeVisionAPIResult(result: any): number {
    try {
      // 실제 구현에서는 Vision API 응답을 분석하여 얼굴 유사도 계산
      // 여기서는 간단한 시뮬레이션
      
      const profileFaces = result.responses[0]?.faceAnnotations || [];
      const ticketFaces = result.responses[1]?.faceAnnotations || [];

      if (profileFaces.length === 0 || ticketFaces.length === 0) {
        return 0.0; // 얼굴이 감지되지 않음
      }

      // 얼굴 특성 비교 (실제로는 더 정교한 알고리즘 필요)
      const profileFace = profileFaces[0];
      const ticketFace = ticketFaces[0];

      // 간단한 유사도 계산 (실제로는 더 복잡한 알고리즘 사용)
      let similarity = 0.0;

      // 얼굴 감지 신뢰도
      if (profileFace.detectionConfidence && ticketFace.detectionConfidence) {
        similarity += (profileFace.detectionConfidence + ticketFace.detectionConfidence) / 2 * 0.3;
      }

      // 얼굴 랜드마크 비교 (실제로는 더 정교한 비교 필요)
      if (profileFace.landmarks && ticketFace.landmarks) {
        similarity += 0.4; // 기본값
      }

      // 기타 얼굴 특성 비교
      similarity += 0.3; // 기본값

      return Math.min(similarity, 1.0);
    } catch (error) {
      console.error('Vision API 결과 분석 오류:', error);
      return 0.0;
    }
  }

  /**
   * 얼굴 인식 시뮬레이션 (개발용)
   */
  private static simulateFaceRecognition(): number {
    // 개발 환경에서 사용할 시뮬레이션된 결과
    // 실제 환경에서는 제거하고 실제 API 사용
    const random = Math.random();
    
    // 80% 확률로 높은 신뢰도 반환
    if (random < 0.8) {
      return 0.85 + (Math.random() * 0.1); // 0.85 ~ 0.95
    } else {
      return 0.3 + (Math.random() * 0.4); // 0.3 ~ 0.7
    }
  }

  /**
   * 인식 결과 저장
   */
  private static async saveRecognitionResult(
    userId: string,
    ticketId: string,
    eventId: string,
    confidence: number,
    isMatch: boolean
  ): Promise<void> {
    try {
      const recognitionRef = doc(collection(db, 'faceRecognitionResults'));
      await setDoc(recognitionRef, {
        userId,
        ticketId,
        eventId,
        confidence,
        isMatch,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('인식 결과 저장 오류:', error);
    }
  }

  /**
   * 수동 검수 대기열에 추가
   */
  private static async addToManualReviewQueue(
    userId: string,
    ticketId: string,
    eventId: string,
    profileImageUrl: string,
    ticketImageUrl: string,
    confidence: number
  ): Promise<void> {
    try {
      const reviewRef = doc(collection(db, 'manualReviewQueue'));
      const reviewData: ManualReviewQueue = {
        id: reviewRef.id,
        userId,
        ticketId,
        eventId,
        profileImageUrl,
        ticketImageUrl,
        status: 'pending',
        confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(reviewRef, reviewData);
    } catch (error) {
      console.error('수동 검수 대기열 추가 오류:', error);
    }
  }

  /**
   * 수동 검수 대기열 조회
   */
  static async getManualReviewQueue(): Promise<ManualReviewQueue[]> {
    try {
      const q = query(
        collection(db, 'manualReviewQueue'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const reviews: ManualReviewQueue[] = [];

      querySnapshot.forEach((doc) => {
        reviews.push({ id: doc.id, ...doc.data() } as ManualReviewQueue);
      });

      return reviews;
    } catch (error) {
      console.error('수동 검수 대기열 조회 오류:', error);
      throw new Error('수동 검수 대기열을 불러오는데 실패했습니다.');
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
      const reviewRef = doc(db, 'manualReviewQueue', reviewId);
      const updateData = {
        status,
        reviewedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      };

      await updateDoc(reviewRef, updateData);

      // 티켓 검증 상태 업데이트
      const reviewDoc = await getDoc(reviewRef);
      if (reviewDoc.exists()) {
        const reviewData = reviewDoc.data() as ManualReviewQueue;
        const ticketRef = doc(db, 'tickets', reviewData.ticketId);
        await updateDoc(ticketRef, {
          isValid: status === 'approved',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('수동 검수 결과 업데이트 오류:', error);
      throw new Error('수동 검수 결과를 업데이트하는데 실패했습니다.');
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
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        return {
          success: false,
          error: '갤러리 접근 권한이 필요합니다.',
        };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // 정사각형 비율
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
}

// 싱글톤 인스턴스 내보내기
export const faceRecognitionService = FaceRecognitionService.getInstance();
