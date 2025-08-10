import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from './authService';

// 사용자 서비스 클래스
export class UserService {
  private static instance: UserService;
  private readonly COLLECTION_NAME = 'users';

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  // 사용자 프로필 생성
  async createUserProfile(uid: string, profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, this.COLLECTION_NAME, uid), {
        ...profile,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('사용자 프로필 생성 오류:', error);
      throw error;
    }
  }

  // 사용자 프로필 조회
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, this.COLLECTION_NAME, uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('사용자 프로필 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 프로필 업데이트
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(doc(db, this.COLLECTION_NAME, uid), updateData);
    } catch (error) {
      console.error('사용자 프로필 업데이트 오류:', error);
      throw error;
    }
  }

  // 사용자 프로필 삭제
  async deleteUserProfile(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, uid));
    } catch (error) {
      console.error('사용자 프로필 삭제 오류:', error);
      throw error;
    }
  }

  // 이메일로 사용자 검색
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const usersRef = collection(db, this.COLLECTION_NAME);
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('이메일로 사용자 검색 오류:', error);
      throw error;
    }
  }

  // 사용자 목록 조회 (페이지네이션)
  async getUsers(
    pageSize: number = 10, 
    lastDoc?: QueryDocumentSnapshot
  ): Promise<{ users: UserProfile[], lastDoc: QueryDocumentSnapshot | null }> {
    try {
      const usersRef = collection(db, this.COLLECTION_NAME);
      let q = query(
        usersRef, 
        orderBy('createdAt', 'desc'), 
        limit(pageSize)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      const users: UserProfile[] = [];
      
      querySnapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });

      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      return {
        users,
        lastDoc: lastVisible
      };
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 검증 상태 업데이트
  async updateUserVerificationStatus(uid: string, isVerified: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, uid), {
        isVerified,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('사용자 검증 상태 업데이트 오류:', error);
      throw error;
    }
  }

  // 사용자 설정 업데이트
  async updateUserPreferences(uid: string, preferences: UserProfile['preferences']): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, uid), {
        preferences,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('사용자 설정 업데이트 오류:', error);
      throw error;
    }
  }

  // 사용자 통계 조회
  async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    activeUsers: number;
  }> {
    try {
      const usersRef = collection(db, this.COLLECTION_NAME);
      
      // 전체 사용자 수
      const totalQuery = query(usersRef);
      const totalSnapshot = await getDocs(totalQuery);
      const totalUsers = totalSnapshot.size;

      // 검증된 사용자 수
      const verifiedQuery = query(usersRef, where('isVerified', '==', true));
      const verifiedSnapshot = await getDocs(verifiedQuery);
      const verifiedUsers = verifiedSnapshot.size;

      // 활성 사용자 수 (최근 30일 내 생성)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeQuery = query(
        usersRef, 
        where('createdAt', '>=', thirtyDaysAgo)
      );
      const activeSnapshot = await getDocs(activeQuery);
      const activeUsers = activeSnapshot.size;

      return {
        totalUsers,
        verifiedUsers,
        activeUsers
      };
    } catch (error) {
      console.error('사용자 통계 조회 오류:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const userService = UserService.getInstance();
