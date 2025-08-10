import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList, RootStackParamList } from '../types/navigation';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { EventService } from '../services/eventService';
import { QueueService } from '../services/queueService';
import { useAuth } from '../contexts/AuthContext';
import { EventData, TimeSlotData, QueueData } from '../types/firestore';
import { logError, getUserFriendlyErrorMessage } from '../utils/errorUtils';
import { formatDate } from '../utils/firestoreUtils';

type QueueScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Queue'>,
  StackNavigationProp<RootStackParamList>
>;

interface QueueScreenProps {
  navigation: QueueScreenNavigationProp;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotData[]>([]);
  const [userQueues, setUserQueues] = useState<QueueData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueTimeSlots, setQueueTimeSlots] = useState<{ [key: string]: TimeSlotData }>({});

  // 이벤트 목록 로드
  const loadEvents = async () => {
    try {
      setLoading(true);
      const eventsData = await EventService.getActiveEvents();
      setEvents(eventsData);
    } catch (error) {
      logError('QueueScreen.loadEvents', error);
      Alert.alert('오류', '이벤트 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 타임슬롯 로드
  const loadTimeSlots = async (eventId: string) => {
    try {
      const timeSlotsData = await EventService.getTimeSlotsByEventId(eventId);
      setTimeSlots(timeSlotsData);
    } catch (error) {
      logError('QueueScreen.loadTimeSlots', error);
      Alert.alert('오류', '타임슬롯 정보를 불러오는데 실패했습니다.');
    }
  };

  // 사용자 대기열 로드
  const loadUserQueues = async () => {
    if (!user) return;
    
    try {
      setQueueLoading(true);
      const queues = await QueueService.getUserQueues(user.uid);
      setUserQueues(queues);
      
      // 각 대기열의 타임슬롯 정보를 개별적으로 로드
      const timeSlotPromises = queues.map(async (queue) => {
        try {
          const timeSlot = await EventService.getTimeSlotById(queue.timeSlotId);
          return { queueId: queue.id, timeSlot };
        } catch (error) {
          console.error(`타임슬롯 로드 실패 (${queue.timeSlotId}):`, error);
          return { queueId: queue.id, timeSlot: null };
        }
      });
      
      const timeSlotResults = await Promise.all(timeSlotPromises);
      const timeSlotMap: { [key: string]: TimeSlotData } = {};
      
      timeSlotResults.forEach(({ queueId, timeSlot }) => {
        if (timeSlot) {
          timeSlotMap[queueId] = timeSlot;
        }
      });
      
      setQueueTimeSlots(timeSlotMap);
    } catch (error) {
      logError('QueueScreen.loadUserQueues', error);
      Alert.alert('오류', '대기열 정보를 불러오는데 실패했습니다.');
    } finally {
      setQueueLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('QueueScreen: 초기 데이터 로드 시작');
        await loadEvents();
        if (user) {
          await loadUserQueues();
        }
      } catch (error) {
        console.error('QueueScreen: 초기 데이터 로드 실패:', error);
      }
    };

    initializeData();
  }, [user]);

  // 화면이 포커스될 때마다 대기열 정보 새로고침
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('QueueScreen: 화면 포커스 감지, 대기열 정보 새로고침 - userId:', user.uid);
        loadUserQueues();
        // 이벤트 목록도 함께 새로고침
        loadEvents();
      }
    }, [user])
  );

  // 선택된 이벤트의 타임슬롯 로드
  useEffect(() => {
    if (selectedEvent) {
      loadTimeSlots(selectedEvent);
    } else {
      setTimeSlots([]);
    }
  }, [selectedEvent]);

  const handleQueueRegistration = async () => {
    if (!selectedEvent || !selectedTimeSlot) {
      Alert.alert('알림', '이벤트와 시간대를 선택해주세요.');
      return;
    }

    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    // 이미 해당 이벤트에 등록되어 있는지 확인
    const isAlreadyRegistered = userQueues.some(q => q.eventId === selectedEvent);
    if (isAlreadyRegistered) {
      Alert.alert('알림', '이미 해당 이벤트에 등록되어 있습니다.');
      return;
    }

    console.log('QueueScreen: 대기열 등록 시작 - 이벤트:', selectedEvent, '타임슬롯:', selectedTimeSlot, '사용자:', user.uid);

    try {
      setRegistering(true);
      console.log('QueueScreen: QueueService.joinQueue 호출 중...');
      const queueData = await QueueService.joinQueue(selectedEvent, selectedTimeSlot, user.uid);
      
      // 등록된 대기열 정보 업데이트
      setUserQueues(prevQueues => [...prevQueues, queueData]);
      
      // 선택 상태 즉시 초기화
      setSelectedEvent('');
      setSelectedTimeSlot('');
      
      // 이벤트 목록과 사용자 대기열 새로고침
      await loadEvents();
      await loadUserQueues();
      
      // 선택된 이벤트와 타임슬롯 정보 가져오기
      const selectedEventData = events.find(e => e.id === selectedEvent);
      const selectedTimeSlotData = timeSlots.find(t => t.id === selectedTimeSlot);
      
      Alert.alert(
        '대기열 등록 완료!', 
        `🎉 ${selectedEventData?.name}\n⏰ ${selectedTimeSlotData?.startTime} - ${selectedTimeSlotData?.endTime}\n📋 순번: ${queueData.queueNumber}번\n\n현재 대기 중입니다. 호출 알림을 기다려주세요!`,
        [
          {
            text: '상태 확인',
            onPress: () => {
              navigation.navigate('QueueStatus');
            },
          },
          {
            text: '확인',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      logError('QueueScreen.handleQueueRegistration', error);
      const errorMessage = getUserFriendlyErrorMessage(error);
      Alert.alert('오류', errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  // 전체 로딩 상태 (이벤트 로딩 + 대기열 로딩)
  const isFullyLoading = loading || (user && queueLoading);

  if (isFullyLoading) {
    return <Loader text="정보를 불러오는 중..." fullScreen />;
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>대기열 등록</Text>
          <Text style={styles.subtitle}>원하는 이벤트와 시간대를 선택하세요</Text>
        </View>

        {/* 현재 등록된 대기열이 있는 경우 */}
        {userQueues.length > 0 && (
          <View style={styles.currentQueueSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>현재 등록된 대기열</Text>
              <Button
                title="상태 모두보기"
                onPress={() => {
                  navigation.navigate('QueueStatus');
                }}
                variant="outline"
                size="small"
                style={styles.viewAllStatusButton}
              />
            </View>
            {userQueues.map((queue, index) => {
              // 해당 이벤트 정보 찾기
              const eventData = events.find(e => e.id === queue.eventId);
              const timeSlotData = queueTimeSlots[queue.id]; // 개별 로드된 타임슬롯 정보 사용
              
              // 입장 현황 게이지 계산 (실제 입장 진행 상황 반영)
              const getProgressPercentage = (status: string) => {
                switch (status) {
                  case 'waiting': return 0; // 대기 중: 아직 입장 시작 안됨
                  case 'called': return 50; // 호출됨: 입장 준비 단계
                  case 'entered': return 100; // 입장 완료
                  case 'cancelled': return 0; // 취소됨
                  default: return 0;
                }
              };
              
              const progressPercentage = getProgressPercentage(queue.status);
              
              return (
                <View key={queue.id} style={styles.currentQueueCard}>
                  {/* 통합 정보 섹션 */}
                  <View style={styles.queueInfoContainer}>
                    {/* 시간대 정보를 먼저 표시 */}
                    {timeSlotData && (
                      <View style={styles.timeSlotInfo}>
                        <Text style={styles.timeSlotTime}>
                          시간대: {timeSlotData.startTime} - {timeSlotData.endTime}
                        </Text>
                      </View>
                    )}
                    
                    <View style={styles.queueBasicInfo}>
                      <Text style={styles.queueNumber}>순번: {queue.queueNumber}번</Text>
                      <Text style={[styles.queueStatus, { color: queue.status === 'waiting' ? '#FF9500' : queue.status === 'called' ? '#007AFF' : '#34C759' }]}>
                        {queue.status === 'waiting' ? '대기 중' : queue.status === 'called' ? '호출됨' : '입장 완료'}
                      </Text>
                    </View>
                    
                    {queue.estimatedWaitTime && (
                      <Text style={styles.waitTime}>
                        예상 대기 시간: {Math.floor(queue.estimatedWaitTime / 60)}시간 {queue.estimatedWaitTime % 60}분
                      </Text>
                    )}
                    
                    {/* 이벤트 정보 */}
                    {eventData && (
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventName}>{eventData.name}</Text>
                        <Text style={styles.eventDate}>{formatDate(eventData.date)}</Text>
                        <Text style={styles.eventLocation}>{eventData.location}</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* 입장 현황 게이지 */}
                  <View style={styles.progressContainer}>
                    <Text style={styles.progressLabel}>입장 현황</Text>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${progressPercentage}%`,
                            backgroundColor: progressPercentage === 0 ? '#FF9500' : progressPercentage === 50 ? '#007AFF' : '#34C759'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>{progressPercentage}%</Text>
                  </View>
                  
                  <Button
                    title="상태 자세히 보기"
                    onPress={() => {
                      navigation.navigate('QueueDetail', { queueId: queue.id });
                    }}
                    variant="outline"
                    style={styles.viewStatusButton}
                  />
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이벤트 선택</Text>
          {events.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>등록 가능한 이벤트가 없습니다</Text>
              <Text style={styles.emptyStateSubtext}>
                새로운 이벤트가 등록되면 여기에 표시됩니다
              </Text>
            </View>
          ) : (
            events
              .filter(event => !userQueues.some(q => q.eventId === event.id)) // 이미 등록된 이벤트 제외
              .map((event) => {
                return (
                  <View key={event.id} style={styles.eventContainer}>
                    <View style={styles.eventCard}>
                      <Text style={styles.eventName}>{event.name}</Text>
                      <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
                      <Text style={styles.eventLocation}>{event.location}</Text>
                      
                      <Button
                        title={selectedEvent === event.id ? '선택됨' : '선택'}
                        onPress={() => {
                          console.log('이벤트 선택됨:', event.id, event.name);
                          setSelectedEvent(event.id);
                          setSelectedTimeSlot(''); // 이벤트 변경 시 타임슬롯 초기화
                        }}
                        style={[
                          styles.selectButton,
                          ...(selectedEvent === event.id ? [styles.selectedButton] : [])
                        ]}
                        textStyle={selectedEvent === event.id ? styles.selectedButtonText : styles.selectButtonText}
                      />
                    </View>
                  
                    {/* 선택된 이벤트의 타임슬롯 표시 */}
                    {selectedEvent === event.id && (
                      <View style={styles.timeSlotSection}>
                        <Text style={styles.timeSlotTitle}>시간대 선택</Text>
                        {timeSlots.length === 0 ? (
                          <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>타임슬롯 정보를 불러오는 중...</Text>
                          </View>
                        ) : (
                          timeSlots.map((slot) => {
                            const availableCount = EventService.getAvailableCapacity(slot);
                            const isAvailable = EventService.isTimeSlotAvailable(slot);
                            
                            return (
                              <View key={slot.id} style={styles.timeSlotCard}>
                                <Text style={styles.timeSlotTime}>{slot.startTime} - {slot.endTime}</Text>
                                <Text style={styles.timeSlotAvailable}>
                                  남은 자리: {availableCount}개
                                </Text>
                                <Text style={styles.timeSlotStatus}>
                                  상태: {slot.status === 'available' ? '사용 가능' : 
                                         slot.status === 'full' ? '마감' : '종료'}
                                </Text>
                                <Button
                                  title={selectedTimeSlot === slot.id ? '선택됨' : '선택'}
                                  onPress={() => setSelectedTimeSlot(slot.id)}
                                  disabled={!isAvailable}
                                                          style={[
                          styles.selectButton,
                          selectedTimeSlot === slot.id && styles.selectedButton,
                          !isAvailable && styles.disabledButton
                        ]}
                                  textStyle={selectedTimeSlot === slot.id ? styles.selectedButtonText : styles.selectButtonText}
                                />
                              </View>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                );
              })
          )}
        </View>
      </ScrollView>
      
      {/* 하단 고정 대기열 등록 버튼 */}
      {selectedEvent && selectedTimeSlot && !userQueues.some(q => q.eventId === selectedEvent) && (
        <View style={styles.fixedButtonContainer}>
          <Button
            title={registering ? "등록 중..." : "대기열 등록하기"}
            onPress={handleQueueRegistration}
            disabled={registering}
            style={styles.registerButton}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200, // 고정 버튼 공간 확보 (100에서 200으로 증가)
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    margin: 20,
  },
  currentQueueSection: {
    margin: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllStatusButton: {
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 0, // 버튼과 간격 조정
  },
  currentQueueCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  queueInfoContainer: {
    marginBottom: 16,
  },
  queueBasicInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  queueStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  waitTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  viewStatusButton: {
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  eventContainer: {
    marginBottom: 20,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  timeSlotCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeSlotTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  timeSlotAvailable: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timeSlotStatus: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: '#F2F2F7',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  selectedButton: {
    backgroundColor: '#007AFF',
  },
  selectButtonText: {
    color: '#007AFF',
  },
  selectedButtonText: {
    color: '#FFFFFF',
  },
  timeSlotSection: {
    marginTop: 12,
    paddingLeft: 16,
  },
  timeSlotTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  buttonContainer: {
    padding: 20,
    marginBottom: 20,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  registerButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
  },
  newRegisterButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    marginTop: 12,
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
    borderColor: '#C7C7CC',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  testButton: {
    borderColor: '#34C759',
    borderWidth: 1,
    backgroundColor: '#F0FFF0',
  },
  registeredEventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  registeredBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  registeredBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  viewQueueButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewQueueButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventInfo: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  timeSlotInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
  },
  progressContainer: {
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'right',
    marginTop: 8,
  },
});
