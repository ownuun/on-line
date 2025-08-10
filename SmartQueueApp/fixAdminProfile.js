const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

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

// admin@test.com 계정의 UID
const ADMIN_UID = '6znKYqbKT6TJVGytS2Lh3F60fso2';

// 사용자 프로필 확인 및 수정 함수
async function fixAdminProfile() {
  try {
    console.log('admin@test.com 계정 프로필 확인 중...');
    
    // 1. 현재 프로필 확인
    const userDoc = doc(db, 'users', ADMIN_UID);
    const userSnapshot = await getDoc(userDoc);
    
    if (!userSnapshot.exists()) {
      console.log('❌ 사용자 프로필이 존재하지 않습니다. 새로 생성합니다.');
      
      // 새 프로필 생성
      const newProfile = {
        uid: ADMIN_UID,
        email: 'admin@test.com',
        displayName: '테스트 관리자',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        isVerified: true,
        preferences: {
          notifications: true,
          language: 'ko'
        }
      };
      
      await setDoc(userDoc, newProfile);
      console.log('✅ 관리자 프로필이 생성되었습니다.');
      
    } else {
      console.log('✅ 사용자 프로필이 존재합니다.');
      const userData = userSnapshot.data();
      
      console.log('\n=== 현재 프로필 정보 ===');
      console.log('UID:', userSnapshot.id);
      console.log('이메일:', userData.email);
      console.log('이름:', userData.displayName);
      console.log('역할:', userData.role);
      
      // 2. 관리자 권한 확인 및 수정
      if (userData.role !== 'admin') {
        console.log('\n⚠️ 관리자 권한이 없습니다. 권한을 부여합니다.');
        
        await updateDoc(userDoc, {
          role: 'admin',
          updatedAt: new Date()
        });
        
        console.log('✅ 관리자 권한이 부여되었습니다.');
      } else {
        console.log('\n✅ 이미 관리자 권한을 가지고 있습니다.');
      }
    }
    
    // 3. 최종 확인
    const finalSnapshot = await getDoc(userDoc);
    const finalData = finalSnapshot.data();
    
    console.log('\n=== 최종 프로필 정보 ===');
    console.log('UID:', finalSnapshot.id);
    console.log('이메일:', finalData.email);
    console.log('이름:', finalData.displayName);
    console.log('역할:', finalData.role);
    console.log('생성일:', finalData.createdAt?.toDate());
    console.log('업데이트일:', finalData.updatedAt?.toDate());
    
    console.log('\n🎉 admin@test.com 계정이 관리자 권한을 가지고 있습니다!');
    
  } catch (error) {
    console.error('프로필 수정 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
  }
}

// 스크립트 실행
fixAdminProfile();
