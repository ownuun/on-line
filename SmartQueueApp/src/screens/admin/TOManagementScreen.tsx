import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminService } from '../../services/adminService';
import { EventService } from '../../services/eventService';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { EventData, TimeSlotData } from '../../types/firestore';

interface TimeSlotWithCapacity extends TimeSlotData {
  newCapacity?: number;
}

export const TOManagementScreen: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlotWithCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadTimeSlots(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const activeEvents = await EventService.getActiveEvents();
      setEvents(activeEvents);
      if (activeEvents.length > 0) {
        setSelectedEvent(activeEvents[0]);
      }
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
      const slotsWithCapacity = slots.map(slot => ({
        ...slot,
        newCapacity: slot.maxCapacity,
      }));
      setTimeSlots(slotsWithCapacity);
    } catch (error) {
      console.error('타임슬롯 로드 오류:', error);
      Alert.alert('오류', '타임슬롯 정보를 불러오는데 실패했습니다.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleCapacityChange = (timeSlotId: string, newCapacity: string) => {
    const capacity = parseInt(newCapacity) || 0;
    setTimeSlots(prev => 
      prev.map(slot => 
        slot.id === timeSlotId 
          ? { ...slot, newCapacity: capacity }
          : slot
      )
    );
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      
      if (!selectedEvent) {
        Alert.alert('오류', '이벤트를 선택해주세요.');
        return;
      }

      const timeSlotCapacities = timeSlots
        .filter(slot => slot.newCapacity !== undefined && slot.newCapacity !== slot.maxCapacity)
        .map(slot => ({
          timeSlotId: slot.id,
          maxCapacity: slot.newCapacity!,
        }));

      if (timeSlotCapacities.length === 0) {
        Alert.alert('알림', '변경된 설정이 없습니다.');
        return;
      }

      await AdminService.updateEventTimeSlotsCapacity(
        selectedEvent.id,
        timeSlotCapacities
      );

      // 로컬 상태 업데이트
      setTimeSlots(prev => 
        prev.map(slot => ({
          ...slot,
          maxCapacity: slot.newCapacity || slot.maxCapacity,
        }))
      );

      Alert.alert('성공', 'TO 설정이 업데이트되었습니다.');
    } catch (error) {
      console.error('TO 설정 저장 오류:', error);
      Alert.alert('오류', 'TO 설정을 저장하는데 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => {
    setTimeSlots(prev => 
      prev.map(slot => ({
        ...slot,
        newCapacity: slot.maxCapacity,
      }))
    );
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>TO 설정 관리</Text>
        </View>

        {/* 이벤트 선택 */}
        <View style={styles.eventSelector}>
          <Text style={styles.sectionTitle}>이벤트 선택</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.eventButtons}>
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.eventButton,
                    selectedEvent?.id === event.id && styles.selectedEventButton,
                  ]}
                  onPress={() => setSelectedEvent(event)}
                >
                  <Text
                    style={[
                      styles.eventButtonText,
                      selectedEvent?.id === event.id && styles.selectedEventButtonText,
                    ]}
                  >
                    {event.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 선택된 이벤트 정보 */}
        {selectedEvent && (
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{selectedEvent.name}</Text>
            <Text style={styles.eventDate}>
              {selectedEvent.date.toLocaleDateString('ko-KR')}
            </Text>
            <Text style={styles.eventLocation}>{selectedEvent.location}</Text>
          </View>
        )}

        {/* 타임슬롯 TO 설정 */}
        {selectedEvent && (
          <View style={styles.timeSlotsContainer}>
            <Text style={styles.sectionTitle}>타임슬롯 TO 설정</Text>
            
            {timeSlots.length === 0 ? (
              <View style={styles.emptyTimeSlots}>
                <Text style={styles.emptyTimeSlotsText}>
                  이 이벤트에 등록된 타임슬롯이 없습니다.
                </Text>
              </View>
            ) : (
              timeSlots.map((timeSlot) => {
              const hasChanges = timeSlot.newCapacity !== timeSlot.maxCapacity;
              
              return (
                <View
                  key={timeSlot.id}
                  style={[
                    styles.timeSlotCard,
                    hasChanges && styles.timeSlotCardChanged,
                  ]}
                >
                  <View style={styles.timeSlotHeader}>
                    <Text style={styles.timeSlotTime}>
                      {timeSlot.startTime} - {timeSlot.endTime}
                    </Text>
                    <View style={styles.timeSlotStatus}>
                      <Text
                        style={[
                          styles.statusBadge,
                          timeSlot.status === 'available' && styles.statusAvailable,
                          timeSlot.status === 'full' && styles.statusFull,
                          timeSlot.status === 'closed' && styles.statusClosed,
                        ]}
                      >
                        {timeSlot.status === 'available' && '예약 가능'}
                        {timeSlot.status === 'full' && '마감'}
                        {timeSlot.status === 'closed' && '종료'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.capacityRow}>
                    <View style={styles.capacityInfo}>
                      <Text style={styles.capacityLabel}>현재 설정</Text>
                      <Text style={styles.capacityValue}>
                        {timeSlot.maxCapacity}명
                      </Text>
                    </View>

                    <View style={styles.capacityInput}>
                      <Text style={styles.capacityLabel}>새 설정</Text>
                      <TextInput
                        value={timeSlot.newCapacity?.toString() || ''}
                        onChangeText={(text) => handleCapacityChange(timeSlot.id, text)}
                        placeholder="TO 수량"
                        keyboardType="numeric"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View style={styles.currentStatus}>
                    <Text style={styles.currentStatusText}>
                      현재 대기: {timeSlot.currentCount}명
                    </Text>
                    <Text style={styles.currentStatusText}>
                      남은 자리: {Math.max(0, timeSlot.maxCapacity - timeSlot.currentCount)}명
                    </Text>
                  </View>

                  {hasChanges && (
                    <View style={styles.changeIndicator}>
                      <Text style={styles.changeText}>
                        {timeSlot.newCapacity! > timeSlot.maxCapacity ? '증가' : '감소'}: 
                        {Math.abs(timeSlot.newCapacity! - timeSlot.maxCapacity)}명
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
            )}
          </View>
        )}

        {/* 액션 버튼 */}
        {selectedEvent && (
          <View style={styles.actionButtons}>
            <Button
              title="변경사항 저장"
              onPress={handleSaveChanges}
              loading={saving}
              style={styles.saveButton}
            />
            
            <Button
              title="변경사항 초기화"
              onPress={handleResetChanges}
              style={styles.resetButton}
              variant="outline"
            />
          </View>
        )}

        {/* 안내 메시지 */}
        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              설정 가능한 이벤트가 없습니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  eventSelector: {
    padding: 20,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  eventButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  eventButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedEventButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  eventButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  selectedEventButtonText: {
    color: '#fff',
  },
  eventInfo: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#999',
  },
  timeSlotsContainer: {
    padding: 20,
  },
  timeSlotCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeSlotCardChanged: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeSlotTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timeSlotStatus: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  statusAvailable: {
    backgroundColor: '#e8f5e8',
    color: '#34C759',
  },
  statusFull: {
    backgroundColor: '#ffe8e8',
    color: '#ff6b6b',
  },
  statusClosed: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  capacityInfo: {
    flex: 1,
  },
  capacityInput: {
    flex: 1,
    marginLeft: 16,
  },
  capacityLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  capacityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  currentStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  currentStatusText: {
    fontSize: 12,
    color: '#666',
  },
  changeIndicator: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#e8f5ff',
    borderRadius: 4,
  },
  changeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  resetButton: {
    borderColor: '#007AFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptyTimeSlots: {
    padding: 20,
    alignItems: 'center',
  },
  emptyTimeSlotsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
