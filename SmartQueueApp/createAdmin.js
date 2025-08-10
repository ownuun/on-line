// 관리자 계정 생성 스크립트
// 사용법: node createAdmin.js

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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
const auth = getAuth(app);
const db = getFirestore(app);

// 관리자 계정 생성 함수
async function createAdminAccount() {
  try {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123456';
    const adminDisplayName = '관리자';

    console.log('관리자 계정 생성 중...');

    // 1. Firebase Auth에 사용자 생성
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;

    console.log('Firebase Auth 사용자 생성 완료:', user.uid);

    // 2. 사용자 프로필 업데이트
    await updateProfile(user, {
      displayName: adminDisplayName
    });

    console.log('사용자 프로필 업데이트 완료');

    // 3. Firestore에 관리자 프로필 저장
    const userProfile = {
      uid: user.uid,
      email: adminEmail,
      displayName: adminDisplayName,
      role: 'admin', // 관리자 역할 설정
      createdAt: new Date(),
      updatedAt: new Date(),
      isVerified: true,
      preferences: {
        notifications: true,
        language: 'ko'
      }
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);

    console.log('Firestore 관리자 프로필 저장 완료');
    console.log('관리자 계정 생성 성공!');
    console.log('이메일:', adminEmail);
    console.log('비밀번호:', adminPassword);
    console.log('사용자 ID:', user.uid);

  } catch (error) {
    console.error('관리자 계정 생성 실패:', error);
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
  }
}

// 스크립트 실행
createAdminAccount();
