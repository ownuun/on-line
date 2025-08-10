// 이메일 유효성 검사
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// 비밀번호 강도 검사
export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('비밀번호는 대문자를 포함해야 합니다.');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('비밀번호는 소문자를 포함해야 합니다.');
  }
  
  if (!/\d/.test(password)) {
    errors.push('비밀번호는 숫자를 포함해야 합니다.');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('비밀번호는 특수문자를 포함해야 합니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 전화번호 유효성 검사 (한국)
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
  return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
};

// 전화번호 포맷팅
export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{4})(\d{4})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return phoneNumber;
};

// Firebase 오류 메시지 한글화
export const getFirebaseErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    'auth/user-not-found': '등록되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다.',
    'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
    'auth/too-many-requests': '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
    'auth/user-disabled': '비활성화된 계정입니다.',
    'auth/operation-not-allowed': '허용되지 않은 작업입니다.',
    'auth/invalid-credential': '유효하지 않은 인증 정보입니다.',
    'auth/account-exists-with-different-credential': '다른 방법으로 가입된 계정입니다.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인해주세요.',
    'auth/invalid-verification-code': '유효하지 않은 인증 코드입니다.',
    'auth/invalid-verification-id': '유효하지 않은 인증 ID입니다.',
    'auth/quota-exceeded': '할당량을 초과했습니다.',
    'auth/credential-already-in-use': '이미 사용 중인 인증 정보입니다.',
    'auth/timeout': '요청 시간이 초과되었습니다.',
    'auth/cancelled-popup-request': '팝업 요청이 취소되었습니다.',
    'auth/popup-blocked': '팝업이 차단되었습니다.',
    'auth/popup-closed-by-user': '팝업이 사용자에 의해 닫혔습니다.',
    'auth/invalid-api-key': '유효하지 않은 API 키입니다.',
    'auth/app-not-authorized': '앱이 승인되지 않았습니다.',
    'auth/keychain-error': '키체인 오류가 발생했습니다.',
    'auth/internal-error': '내부 오류가 발생했습니다.',
    'auth/invalid-user-token': '유효하지 않은 사용자 토큰입니다.',
    'auth/user-token-expired': '사용자 토큰이 만료되었습니다.',
    'auth/null-user': '사용자 정보가 없습니다.',
    'auth/app-deleted': '앱이 삭제되었습니다.',
    'auth/invalid-argument': '유효하지 않은 인수입니다.',
    'auth/invalid-tenant-id': '유효하지 않은 테넌트 ID입니다.',
    'auth/unauthorized-continue-uri': '승인되지 않은 계속 URI입니다.',
    'auth/missing-android-pkg-name': 'Android 패키지 이름이 누락되었습니다.',
    'auth/missing-continue-uri': '계속 URI가 누락되었습니다.',
    'auth/missing-ios-bundle-id': 'iOS 번들 ID가 누락되었습니다.',
    'auth/invalid-continue-uri': '유효하지 않은 계속 URI입니다.',
    'auth/unauthorized-continue-uri': '승인되지 않은 계속 URI입니다.',
    'auth/invalid-dynamic-link-domain': '유효하지 않은 동적 링크 도메인입니다.',
    'auth/argument-error': '인수 오류가 발생했습니다.',
    'auth/invalid-persistence-type': '유효하지 않은 지속성 유형입니다.',
    'auth/unsupported-persistence-type': '지원되지 않는 지속성 유형입니다.',
    'auth/invalid-credential': '유효하지 않은 인증 정보입니다.',
    'auth/operation-not-supported-in-this-environment': '이 환경에서 지원되지 않는 작업입니다.',
    'auth/recaptcha-not-enabled': 'reCAPTCHA가 활성화되지 않았습니다.',
    'auth/missing-recaptcha-token': 'reCAPTCHA 토큰이 누락되었습니다.',
    'auth/invalid-recaptcha-token': '유효하지 않은 reCAPTCHA 토큰입니다.',
    'auth/invalid-recaptcha-action': '유효하지 않은 reCAPTCHA 작업입니다.',
    'auth/missing-client-type': '클라이언트 유형이 누락되었습니다.',
    'auth/missing-recaptcha-version': 'reCAPTCHA 버전이 누락되었습니다.',
    'auth/invalid-recaptcha-version': '유효하지 않은 reCAPTCHA 버전입니다.',
    'auth/invalid-req-type': '유효하지 않은 요청 유형입니다.',
  };
  
  return errorMessages[errorCode] || '알 수 없는 오류가 발생했습니다.';
};

// 토큰 만료 시간 확인
export const isTokenExpired = (expirationTime: number): boolean => {
  const currentTime = Date.now() / 1000;
  return currentTime >= expirationTime;
};

// 인증 상태 확인
export const checkAuthStatus = (user: any): {
  isAuthenticated: boolean;
  isVerified: boolean;
  needsVerification: boolean;
} => {
  const isAuthenticated = !!user;
  const isVerified = user?.emailVerified || false;
  const needsVerification = isAuthenticated && !isVerified;
  
  return {
    isAuthenticated,
    isVerified,
    needsVerification
  };
};
