import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// 사용자 프로필 인터페이스
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  profileImageUrl?: string; // 얼굴 인식용 프로필 이미지
  role?: 'user' | 'admin'; // 사용자 역할
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  preferences?: {
    notifications: boolean;
    language: string;
  };
}

// 인증 서비스 클래스
export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;

  private constructor() {
    this.initializeAuthStateListener();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // 인증 상태 리스너 초기화
  private initializeAuthStateListener(): void {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
    });
  }

  // 이메일/비밀번호로 회원가입
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<UserCredential> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 사용자 프로필 업데이트
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }

      // Firestore에 사용자 프로필 저장
      await this.createUserProfile(userCredential.user.uid, {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email,
        displayName: displayName || userCredential.user.displayName || undefined,
        photoURL: userCredential.user.photoURL || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        isVerified: false,
        preferences: {
          notifications: true,
          language: 'ko'
        }
      });

      return userCredential;
    } catch (error) {
      console.error('회원가입 오류:', error);
      throw error;
    }
  }

  // 이메일/비밀번호로 로그인
  async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 로그인 후 사용자 프로필 확인 및 생성
      try {
        const existingProfile = await this.getUserProfile(userCredential.user.uid);
        if (!existingProfile) {
          console.log('사용자 프로필이 없어서 기본 프로필을 생성합니다.');
          // 기본 프로필 생성
          await this.createUserProfile(userCredential.user.uid, {
            uid: userCredential.user.uid,
            email: userCredential.user.email || email,
            displayName: userCredential.user.displayName || undefined,
            photoURL: userCredential.user.photoURL || undefined,
            role: 'user', // 기본값은 일반 사용자
            createdAt: new Date(),
            updatedAt: new Date(),
            isVerified: false,
            preferences: {
              notifications: true,
              language: 'ko'
            }
          });
        }
      } catch (profileError) {
        console.warn('프로필 확인/생성 중 오류 (무시됨):', profileError);
      }
      
      return userCredential;
    } catch (error) {
      console.error('로그인 오류:', error);
      throw error;
    }
  }

  // 로그아웃
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 오류:', error);
      throw error;
    }
  }

  // 비밀번호 재설정 이메일 발송
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('비밀번호 재설정 이메일 발송 오류:', error);
      throw error;
    }
  }

  // 현재 사용자 가져오기
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // 인증 상태 변경 리스너 설정
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  // 사용자 프로필 생성
  private async createUserProfile(uid: string, profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, 'users', uid), profile);
    } catch (error) {
      console.error('사용자 프로필 생성 오류:', error);
      throw error;
    }
  }

  // 사용자 프로필 조회
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = doc(db, 'users', uid);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        const data = userSnapshot.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as UserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('사용자 프로필 조회 오류:', error);
      throw error;
    }
  }

  // 관리자 권한 확인
  async isAdmin(uid: string): Promise<boolean> {
    try {
      const profile = await this.getUserProfile(uid);
      return profile?.role === 'admin';
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error);
      return false;
    }
  }

  // 현재 사용자가 관리자인지 확인
  async isCurrentUserAdmin(): Promise<boolean> {
    if (!this.currentUser) {
      return false;
    }
    return this.isAdmin(this.currentUser.uid);
  }

  // 사용자 프로필 업데이트
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      await updateDoc(doc(db, 'users', uid), updateData);
    } catch (error) {
      console.error('사용자 프로필 업데이트 오류:', error);
      throw error;
    }
  }

  // 이메일로 사용자 검색
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const usersRef = collection(db, 'users');
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
}

// 싱글톤 인스턴스 내보내기
export const authService = AuthService.getInstance();
