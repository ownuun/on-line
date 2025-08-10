const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

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

// 사용자 프로필 디버깅 함수
async function debugUserProfile() {
  try {
    console.log('=== 사용자 프로필 디버깅 시작 ===');
    
    // 1. admin@test.com 계정의 UID
    const ADMIN_UID = '6znKYqbKT6TJVGytS2Lh3F60fso2';
    console.log('관리자 UID:', ADMIN_UID);
    
    // 2. 직접 UID로 프로필 조회
    console.log('\n1. UID로 직접 프로필 조회...');
    const userDoc = doc(db, 'users', ADMIN_UID);
    const userSnapshot = await getDoc(userDoc);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      console.log('✅ 프로필 존재함');
      console.log('이메일:', userData.email);
      console.log('이름:', userData.displayName);
      console.log('역할:', userData.role);
      console.log('생성일:', userData.createdAt?.toDate());
      console.log('업데이트일:', userData.updatedAt?.toDate());
    } else {
      console.log('❌ 프로필이 존재하지 않음');
    }
    
    // 3. 이메일로 프로필 검색
    console.log('\n2. 이메일로 프로필 검색...');
    const usersRef = collection(db, 'users');
    const emailQuery = query(usersRef, where('email', '==', 'admin@test.com'));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      console.log('✅ 이메일로 검색 성공');
      emailSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('UID:', doc.id);
        console.log('이메일:', data.email);
        console.log('역할:', data.role);
      });
    } else {
      console.log('❌ 이메일로 검색 실패');
    }
    
    // 4. 모든 사용자 프로필 확인
    console.log('\n3. 모든 사용자 프로필 확인...');
    const allUsersSnapshot = await getDocs(usersRef);
    console.log(`총 사용자 수: ${allUsersSnapshot.size}`);
    
    allUsersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`- ${data.email} (${data.role || '역할 없음'})`);
    });
    
    console.log('\n=== 디버깅 완료 ===');
    
  } catch (error) {
    console.error('디버깅 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
  }
}

// 스크립트 실행
debugUserProfile();
