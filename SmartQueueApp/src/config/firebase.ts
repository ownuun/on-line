import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getMessaging, Messaging } from 'firebase/messaging';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Firebase configuration - 실제 프로젝트 설정
const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyDOn9wzabkPjuilpR5sL3tX7o9twaMZ-ps",
  authDomain: "on-line-3000e.firebaseapp.com",
  projectId: "on-line-3000e",
  storageBucket: "on-line-3000e.firebasestorage.app",
  messagingSenderId: "3514529175",
  appId: "1:3514529175:web:55026a3fae07d4c3a240d2",
  measurementId: "G-ZF6KN894L3"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage = getStorage(app);

// Analytics는 웹 환경에서만 사용 가능
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Analytics not available:', error);
  }
}

// Messaging은 브라우저 환경에서만 사용 가능
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Messaging not available:', error);
  }
}

export { analytics, messaging };

export default app;
