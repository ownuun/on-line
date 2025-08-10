import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { UserProfile } from '../services/authService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // 사용자 프로필 새로고침
  const refreshUserProfile = async () => {
    if (user) {
      try {
        setProfileLoading(true);
        console.log('사용자 프로필 로딩 시작:', user.uid);
        
        const profile = await authService.getUserProfile(user.uid);
        console.log('사용자 프로필 로딩 완료:', profile);
        
        setUserProfile(profile);
        
        if (profile?.role === 'admin') {
          console.log('✅ 관리자 권한 확인됨');
        } else {
          console.log('❌ 일반 사용자 권한');
        }
      } catch (error) {
        console.error('사용자 프로필 로드 실패:', error);
        console.error('에러 상세:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
      }
    } else {
      console.log('사용자가 없어서 프로필 로딩 건너뜀');
      setUserProfile(null);
      setProfileLoading(false);
    }
  };

  // 로그아웃
  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  useEffect(() => {
    console.log('AuthContext: 인증 상태 리스너 설정');
    // Firebase 인증 상태 변경 리스너 설정
    const unsubscribe = authService.onAuthStateChanged((user) => {
      console.log('AuthContext: 인증 상태 변경됨', user ? `사용자: ${user.uid}` : '로그아웃');
      setUser(user);
      if (user) {
        refreshUserProfile();
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // user 상태가 변경될 때마다 프로필 로딩
  useEffect(() => {
    if (user && !userProfile) {
      console.log('사용자 변경 감지, 프로필 로딩 시작:', user.uid);
      refreshUserProfile();
    }
  }, [user, userProfile]);

  // 사용자 프로필 로딩 상태를 포함한 value
  const value: AuthContextType = {
    user,
    userProfile,
    loading: loading || profileLoading,
    signOut,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
