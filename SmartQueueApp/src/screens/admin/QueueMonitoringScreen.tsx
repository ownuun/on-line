import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminService } from '../../services/adminService';
import { EventService } from '../../services/eventService';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { EventData, TimeSlotData } from '../../types/firestore';

interface TimeSlotStats {
  timeSlotId: string;
  currentCount: number;
  maxCapacity: number;
  status: string;
}

interface EventMonitoringData {
  totalQueued: number;
  totalCalled: number;
  totalEntered: number;
  timeSlotStats: TimeSlotStats[];
}

export const QueueMonitoringScreen: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [monitoringData, setMonitoringData] = useState<EventMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      const unsubscribe = AdminService.subscribeToEventMonitoring(
        selectedEvent.id,
        (data) => {
          setMonitoringData(data);
        },
        (error) => {
          console.error('이벤트 모니터링 오류:', error);
        }
      );

      return () => unsubscribe();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleCallNextPerson = async (timeSlotId: string) => {
    try {
      setCalling(timeSlotId);
      const success = await AdminService.callNextPerson(timeSlotId);
      
      if (success) {
        Alert.alert('성공', '다음 대기자를 호출했습니다.');
      } else {
        Alert.alert('알림', '대기 중인 사용자가 없습니다.');
      }
    } catch (error) {
      console.error('호출 오류:', error);
      Alert.alert('오류', '다음 대기자를 호출하는데 실패했습니다.');
    } finally {
      setCalling(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#34C759';
      case 'full':
        return '#ff6b6b';
      case 'closed':
        return '#999';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return '예약 가능';
      case 'full':
        return '마감';
      case 'closed':
        return '종료';
      default:
        return status;
    }
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
          <Text style={styles.title}>호출 현황 모니터링</Text>
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

        {/* 전체 통계 */}
        {monitoringData && (
          <View style={styles.overallStats}>
            <Text style={styles.sectionTitle}>전체 현황</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{monitoringData.totalQueued}</Text>
                <Text style={styles.statLabel}>대기 중</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{monitoringData.totalCalled}</Text>
                <Text style={styles.statLabel}>호출됨</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{monitoringData.totalEntered}</Text>
                <Text style={styles.statLabel}>입장 완료</Text>
              </View>
            </View>
          </View>
        )}

        {/* 타임슬롯별 현황 */}
        {monitoringData && monitoringData.timeSlotStats.length > 0 && (
          <View style={styles.timeSlotsContainer}>
            <Text style={styles.sectionTitle}>타임슬롯별 현황</Text>
            
            {monitoringData.timeSlotStats.map((timeSlot) => (
              <View key={timeSlot.timeSlotId} style={styles.timeSlotCard}>
                <View style={styles.timeSlotHeader}>
                  <Text style={styles.timeSlotTime}>
                    {timeSlot.startTime} - {timeSlot.endTime}
                  </Text>
                  <View style={styles.timeSlotStatus}>
                    <Text
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(timeSlot.status) + '20', color: getStatusColor(timeSlot.status) },
                      ]}
                    >
                      {getStatusText(timeSlot.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.timeSlotStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>현재 대기</Text>
                    <Text style={styles.statValue}>{timeSlot.currentCount}명</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>최대 수용</Text>
                    <Text style={styles.statValue}>{timeSlot.maxCapacity}명</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>남은 자리</Text>
                    <Text style={styles.statValue}>
                      {Math.max(0, timeSlot.maxCapacity - timeSlot.currentCount)}명
                    </Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, (timeSlot.currentCount / timeSlot.maxCapacity) * 100)}%`,
                        backgroundColor: timeSlot.currentCount >= timeSlot.maxCapacity ? '#ff6b6b' : '#34C759',
                      },
                    ]}
                  />
                </View>

                <View style={styles.actionRow}>
                  <Button
                    title="다음 호출"
                    onPress={() => handleCallNextPerson(timeSlot.timeSlotId)}
                    loading={calling === timeSlot.timeSlotId}
                    disabled={timeSlot.currentCount === 0 || calling !== null}
                    style={styles.callButton}
                  />
                  
                  <View style={styles.estimatedTime}>
                    <Text style={styles.estimatedTimeLabel}>예상 대기</Text>
                    <Text style={styles.estimatedTimeValue}>
                      {timeSlot.currentCount * 2}분
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 안내 메시지 */}
        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              모니터링할 이벤트가 없습니다.
            </Text>
          </View>
        )}

        {selectedEvent && (!monitoringData || monitoringData.timeSlotStats.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              이 이벤트의 타임슬롯 정보가 없습니다.
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
  overallStats: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  timeSlotStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callButton: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#007AFF',
  },
  estimatedTime: {
    alignItems: 'center',
  },
  estimatedTimeLabel: {
    fontSize: 12,
    color: '#666',
  },
  estimatedTimeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
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
});
