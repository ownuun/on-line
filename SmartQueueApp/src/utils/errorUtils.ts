// 사용자 친화적인 에러 메시지 변환
export const getUserFriendlyErrorMessage = (error: any): string => {
  // Firebase Auth 에러
  if (error?.code) {
    switch (error.code) {
      case 'auth/user-not-found':
        return '등록되지 않은 이메일입니다.';
      case 'auth/wrong-password':
        return '비밀번호가 올바르지 않습니다.';
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일입니다.';
      case 'auth/weak-password':
        return '비밀번호가 너무 약합니다. (최소 6자 이상)';
      case 'auth/invalid-email':
        return '유효하지 않은 이메일 형식입니다.';
      case 'auth/too-many-requests':
        return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인해주세요.';
      case 'auth/user-disabled':
        return '비활성화된 계정입니다.';
      case 'auth/operation-not-allowed':
        return '허용되지 않은 작업입니다.';
      case 'auth/invalid-credential':
        return '유효하지 않은 인증 정보입니다.';
      case 'auth/requires-recent-login':
        return '보안을 위해 다시 로그인해주세요.';
      default:
        return '알 수 없는 오류가 발생했습니다.';
    }
  }

  // 일반적인 에러 메시지
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    // 기술적인 메시지를 사용자 친화적으로 변환
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return '네트워크 연결을 확인해주세요.';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return '권한이 없습니다. 로그인을 확인해주세요.';
    }
    
    if (message.includes('not found') || message.includes('존재하지 않')) {
      return '요청한 정보를 찾을 수 없습니다.';
    }
    
    if (message.includes('timeout') || message.includes('시간 초과')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    }
    
    if (message.includes('storage') || message.includes('저장소')) {
      return '파일 저장 중 오류가 발생했습니다.';
    }
    
    if (message.includes('queue') || message.includes('대기열')) {
      return '대기열 처리 중 오류가 발생했습니다.';
    }
    
    if (message.includes('event') || message.includes('이벤트')) {
      return '이벤트 정보를 불러오는데 실패했습니다.';
    }
    
    if (message.includes('ticket') || message.includes('티켓')) {
      return '티켓 처리 중 오류가 발생했습니다.';
    }
    
    return error.message;
  }

  return '알 수 없는 오류가 발생했습니다.';
};

// 에러 로깅
export const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${context}] Error:`, {
    error,
    additionalInfo,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  });
};

// 재시도 가능한 에러인지 확인
export const isRetryableError = (error: any): boolean => {
  if (error?.code) {
    // 네트워크 관련 에러는 재시도 가능
    return ['auth/network-request-failed', 'auth/too-many-requests'].includes(error.code);
  }
  
  if (error?.message) {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('fetch');
  }
  
  return false;
};

// 에러 타입 분류
export const getErrorType = (error: any): 'network' | 'auth' | 'permission' | 'validation' | 'server' | 'unknown' => {
  if (error?.code?.startsWith('auth/')) {
    return 'auth';
  }
  
  if (error?.code?.startsWith('permission/')) {
    return 'permission';
  }
  
  if (error?.message) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    if (message.includes('server') || message.includes('500')) {
      return 'server';
    }
  }
  
  return 'unknown';
};
