const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDOn9wzabkPjuilpR5sL3tX7o9twaMZ-ps",
  authDomain: "on-line-3000e.firebaseapp.com",
  projectId: "on-line-3000e",
  storageBucket: "on-line-3000e.firebasestorage.app",
  messagingSenderId: "3514529175",
  appId: "1:3514529175:web:55026a3fae07d4c3a240d2",
  measurementId: "G-ZF6KN894L3"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 사용자 권한 확인 함수
async function checkUserRole(email) {
  try {
    console.log(`사용자 권한 확인 중: ${email}`);
    
    // 이메일로 사용자 검색
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ 해당 이메일의 사용자를 찾을 수 없습니다.');
      return;
    }
    
    // 첫 번째 사용자 정보 가져오기
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('\n=== 사용자 정보 ===');
    console.log('UID:', userDoc.id);
    console.log('이메일:', userData.email);
    console.log('이름:', userData.displayName || '설정되지 않음');
    console.log('역할:', userData.role || '설정되지 않음');
    console.log('생성일:', userData.createdAt?.toDate() || '알 수 없음');
    console.log('업데이트일:', userData.updatedAt?.toDate() || '알 수 없음');
    
    if (userData.role === 'admin') {
      console.log('\n✅ 이 사용자는 관리자 권한을 가지고 있습니다!');
    } else {
      console.log('\n❌ 이 사용자는 관리자 권한이 없습니다.');
      console.log('관리자 권한을 부여하려면 Firebase Console에서 role을 "admin"으로 설정하세요.');
    }
    
  } catch (error) {
    console.error('사용자 권한 확인 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
  }
}

// 스크립트 실행
const emailToCheck = 'admin@test.com';
checkUserRole(emailToCheck);
