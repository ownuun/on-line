import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { useAuth } from '../contexts/AuthContext';
import { TicketService, TicketInfo } from '../services/ticketService';
import { EventService } from '../services/eventService';
import { EventData, TimeSlotData } from '../types/firestore';

export const TicketUploadScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [events, setEvents] = useState<EventData[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotData[]>([]);
  const [userTicket, setUserTicket] = useState<TicketInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // 이벤트 목록 로드
  useEffect(() => {
    loadEvents();
  }, []);

  // 선택된 이벤트의 타임슬롯 로드
  useEffect(() => {
    if (selectedEvent) {
      loadTimeSlots(selectedEvent);
    } else {
      setTimeSlots([]);
    }
  }, [selectedEvent]);

  // 사용자 티켓 정보 로드
  useEffect(() => {
    if (user) {
      loadUserTicket();
    }
  }, [user]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const activeEvents = await EventService.getActiveEvents();
      setEvents(activeEvents);
    } catch (error) {
      console.error('이벤트 로드 오류:', error);
      Alert.alert('오류', '이벤트 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async (eventId: string) => {
    try {
      const slots = await EventService.getTimeSlotsByEventId(eventId);
      setTimeSlots(slots);
    } catch (error) {
      console.error('타임슬롯 로드 오류:', error);
      Alert.alert('오류', '타임슬롯 정보를 불러오는데 실패했습니다.');
    }
  };

  const loadUserTicket = async () => {
    if (!user) return;
    
    try {
      const ticket = await TicketService.getUserTicket(user.uid);
      setUserTicket(ticket);
    } catch (error) {
      console.error('사용자 티켓 로드 오류:', error);
    }
  };

  const handleTicketUpload = async () => {
    if (!selectedEvent || !selectedTimeSlot) {
      Alert.alert('알림', '이벤트와 시간대를 선택해주세요.');
      return;
    }

    if (!user) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }

    try {
      setUploading(true);
      const result = await TicketService.uploadTicketImage(
        user.uid,
        selectedEvent,
        selectedTimeSlot
      );

      if (result.success) {
        Alert.alert(
          '업로드 성공',
          '티켓 이미지가 성공적으로 업로드되었습니다. 관리자 검증 후 사용 가능합니다.',
          [
            {
              text: '확인',
              onPress: () => {
                // 선택 초기화
                setSelectedEvent('');
                setSelectedTimeSlot('');
                // 티켓 정보 새로고침
                loadUserTicket();
              },
            },
          ]
        );
      } else {
        Alert.alert('업로드 실패', result.error || '티켓 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('티켓 업로드 오류:', error);
      Alert.alert('오류', '티켓 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!userTicket) return;

    Alert.alert(
      '티켓 삭제',
      '등록된 티켓을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await TicketService.deleteTicketImage(userTicket.id);
              setUserTicket(null);
              Alert.alert('삭제 완료', '티켓이 삭제되었습니다.');
            } catch (error) {
              console.error('티켓 삭제 오류:', error);
              Alert.alert('오류', '티켓 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <Loader text="이벤트 목록을 불러오는 중..." fullScreen />;
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      bounces={true}
    >
      <View style={styles.header}>
        <Text style={styles.title}>티켓 업로드</Text>
        <Text style={styles.subtitle}>입장을 위한 티켓 이미지를 업로드하세요</Text>
      </View>

      {/* 기존 티켓 정보 */}
      {userTicket && (
        <View style={styles.existingTicketSection}>
          <Text style={styles.sectionTitle}>등록된 티켓</Text>
          <View style={styles.ticketCard}>
            <Image
              source={{ uri: userTicket.ticketImageUrl }}
              style={styles.ticketImage}
              resizeMode="cover"
            />
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketNumber}>티켓 번호: {userTicket.ticketNumber}</Text>
              <Text style={styles.ticketStatus}>
                상태: {userTicket.isValid ? '검증 완료' : '검증 대기 중'}
              </Text>
              <Text style={styles.ticketDate}>
                등록일: {new Date(userTicket.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Button
              title="티켓 삭제"
              onPress={handleDeleteTicket}
              variant="outline"
              style={styles.deleteButton}
            />
          </View>
        </View>
      )}

      {/* 새 티켓 업로드 */}
      {!userTicket && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>이벤트 선택</Text>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>등록 가능한 이벤트가 없습니다</Text>
                <Text style={styles.emptyStateSubtext}>관리자가 이벤트를 생성할 때까지 기다려주세요.</Text>
              </View>
            ) : (
              events.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <Text style={styles.eventDate}>
                    {new Date(event.date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.eventLocation}>{event.location}</Text>
                  <Button
                    title={selectedEvent === event.id ? '선택됨' : '선택'}
                    onPress={() => setSelectedEvent(event.id)}
                    style={[
                      styles.selectButton,
                      selectedEvent === event.id && styles.selectedButton
                    ]}
                    textStyle={selectedEvent === event.id ? styles.selectedButtonText : styles.selectButtonText}
                  />
                </View>
              ))
            )}
          </View>

          {selectedEvent && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>시간대 선택</Text>
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
                      <Text style={styles.timeSlotTime}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <Text style={styles.timeSlotAvailable}>
                        남은 자리: {availableCount}개
                      </Text>
                      <Button
                        title={selectedTimeSlot === slot.id ? '선택됨' : '선택'}
                        onPress={() => setSelectedTimeSlot(slot.id)}
                        disabled={!isAvailable}
                        style={[
                          styles.selectButton,
                          selectedTimeSlot === slot.id && styles.selectedButton,
                          !isAvailable && styles.disabledButton
                        ].filter(Boolean) as any}
                        textStyle={selectedTimeSlot === slot.id ? styles.selectedButtonText : styles.selectButtonText}
                      />
                    </View>
                  );
                })
              )}
            </View>
          )}

          {selectedEvent && selectedTimeSlot && (
            <View style={styles.buttonContainer}>
              <Button
                title={uploading ? "업로드 중..." : "티켓 이미지 업로드"}
                onPress={handleTicketUpload}
                disabled={uploading}
                style={styles.uploadButton}
              />
            </View>
          )}
        </>
      )}

      {/* 뒤로가기 버튼 */}
      <View style={styles.backButtonContainer}>
        <Button
          title="뒤로가기"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.backButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingBottom: 20, // 하단 패딩 추가
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
  existingTicketSection: {
    margin: 20,
  },
  section: {
    margin: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  ticketInfo: {
    marginBottom: 12,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  ticketStatus: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  ticketDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  deleteButton: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  eventCard: {
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
  buttonContainer: {
    padding: 20,
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
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
  testButton: {
    borderColor: '#34C759',
    borderWidth: 1,
    backgroundColor: '#F0FFF0',
    marginTop: 16,
  },
  backButtonContainer: {
    padding: 20,
    marginBottom: 20,
  },
  backButton: {
    borderColor: '#8E8E93',
    borderWidth: 1,
  },
});
