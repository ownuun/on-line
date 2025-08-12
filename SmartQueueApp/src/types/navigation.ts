import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

// 인증 스택 네비게이션 타입
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

// 메인 탭 네비게이션 타입
export type MainTabParamList = {
  Home: undefined;
  Queue: undefined;
  QueueStatus: undefined;
  Notifications: undefined;
  Profile: undefined;
};

// 루트 스택 네비게이션 타입
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  QueueDetail: { queueId: string };
  QueueStatus: undefined;
  TicketUpload: { eventId: string };
  EventDetail: { eventId: string };
  Settings: undefined;
  CompanionRequest: { queueId: string };
  CompanionMatching: { queueId: string };
};

// 네비게이션 프로퍼티 타입들
export type AuthStackNavigationProp = StackNavigationProp<AuthStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;

// 복합 네비게이션 타입 (탭 내에서 스택 네비게이션 사용 시)
export type MainTabCompositeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  StackNavigationProp<RootStackParamList>
>;

// 라우트 프로퍼티 타입들
export type QueueDetailRouteProp = RouteProp<RootStackParamList, 'QueueDetail'>;
export type TicketUploadRouteProp = RouteProp<RootStackParamList, 'TicketUpload'>;
export type EventDetailRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;
