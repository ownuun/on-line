# SmartQueueApp - 스마트줄서기

디지털 온라인 줄서기 시스템 - 콘서트·페스티벌 관객을 위한 모바일 앱

## 프로젝트 개요

이 프로젝트는 콘서트·페스티벌 관객이 행사 이틀 전 모바일 앱으로 파트별(타임 슬롯) 온라인 줄서기를 하고, 행사 당일 실시간 호출 알림에 맞춰 빠르고 편안하게 입장할 수 있도록 돕는 시스템입니다.

## 기술 스택

- **Frontend**: React Native (TypeScript)
- **Backend**: Firebase (Authentication, Firestore)
- **CI/CD**: GitHub Actions
- **배포**: Firebase App Distribution

## 개발 환경 설정

### 필수 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- Expo CLI
- Android Studio (Android 개발용)
- Xcode (iOS 개발용, macOS만)

### 설치 및 실행

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **Firebase 설정**
   - Firebase Console에서 새 프로젝트 생성
   - `src/config/firebase.ts` 파일의 설정값을 실제 Firebase 프로젝트 설정으로 교체

3. **Google Cloud Vision API 설정 (얼굴 인식 기능용)**
   - Google Cloud Console에서 Vision API 활성화
   - API 키 생성 후 환경 변수 설정:
     ```bash
     export GOOGLE_CLOUD_VISION_API_KEY="your-api-key-here"
     ```
   - 또는 `.env` 파일에 추가:
     ```
     GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here
     ```

4. **개발 서버 실행**
   ```bash
   # Android
   npm run android
   
   # iOS (macOS만)
   npm run ios
   
   # 웹
   npm run web
   ```

## 프로젝트 구조

```
src/
├── components/     # 재사용 가능한 UI 컴포넌트
├── screens/        # 앱 화면/뷰
├── services/       # API 클라이언트 및 데이터 페칭
├── utils/          # 유틸리티 함수
└── config/         # 설정 파일 (Firebase 등)
```

## CI/CD 파이프라인

GitHub Actions를 통해 자동화된 빌드 및 배포가 구성되어 있습니다:

- **테스트**: 코드 품질 검사 및 테스트 실행
- **빌드**: Android APK 및 iOS 빌드 생성
- **배포**: Firebase App Distribution을 통한 자동 배포

## 주요 기능

1. 온라인 파트별 줄서기 (타임 슬롯 선택 후 선착순 번호 발급)
2. 실시간 입장 번호 호출 & 푸시/문자 알림
3. 티켓 인증 + 얼굴 인식 기반 본인 확인
4. 파트별 TO(정원) 시뮬레이션 및 권장 수치 계산

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
