import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { EventService } from '../../services/eventService';
import { EventData } from '../../types/firestore';
import { useAuth } from '../../contexts/AuthContext';

interface TimeSlotInput {
  startTime: string;
  endTime: string;
  maxCapacity: string;
}

interface EventFormData {
  name: string;
  description: string;
  date: string;
  location: string;
  maxCapacity: string;
  timeSlots: TimeSlotInput[];
}

export const EventManagementScreen: React.FC = () => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    date: '',
    location: '',
    maxCapacity: '',
    timeSlots: [{ startTime: '', endTime: '', maxCapacity: '' }],
  });

  useEffect(() => {
    loadEvents();
  }, []);

  // 사용자 정보 로그 출력
  useEffect(() => {
    console.log('=== 현재 사용자 정보 ===');
    console.log('사용자 UID:', user?.uid);
    console.log('사용자 이메일:', user?.email);
    console.log('사용자 프로필:', userProfile);
    console.log('관리자 권한:', user?.email === 'admin@test.com' ? '관리자' : '일반 사용자');
    
    if (user?.email === 'admin@test.com') {
      console.log('✅ admin@test.com 계정으로 관리자 권한 확인됨');
    }
  }, [user, userProfile]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const allEvents = await EventService.getAllEvents();
      setEvents(allEvents);
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      date: '',
      location: '',
      maxCapacity: '',
      timeSlots: [{ startTime: '', endTime: '', maxCapacity: '' }],
    });
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { startTime: '', endTime: '', maxCapacity: '' }],
    }));
  };

  const removeTimeSlot = (index: number) => {
    if (formData.timeSlots.length > 1) {
      setFormData(prev => ({
        ...prev,
        timeSlots: prev.timeSlots.filter((_, i) => i !== index),
      }));
    }
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlotInput, value: string) => {
    setFormData(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const handleCreateEvent = async () => {
    // 폼 검증
    if (!formData.name.trim()) {
      Alert.alert('오류', '이벤트 이름을 입력해주세요.');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('오류', '이벤트 설명을 입력해주세요.');
      return;
    }
    if (!formData.date.trim()) {
      Alert.alert('오류', '이벤트 날짜를 입력해주세요.');
      return;
    }
    if (!formData.location.trim()) {
      Alert.alert('오류', '이벤트 장소를 입력해주세요.');
      return;
    }
    if (!formData.maxCapacity.trim() || parseInt(formData.maxCapacity) <= 0) {
      Alert.alert('오류', '최대 인원을 입력해주세요.');
      return;
    }

    // 타임슬롯 검증
    for (let i = 0; i < formData.timeSlots.length; i++) {
      const slot = formData.timeSlots[i];
      if (!slot.startTime.trim() || !slot.endTime.trim() || !slot.maxCapacity.trim()) {
        Alert.alert('오류', `타임슬롯 ${i + 1}의 모든 필드를 입력해주세요.`);
        return;
      }
      if (parseInt(slot.maxCapacity) <= 0) {
        Alert.alert('오류', `타임슬롯 ${i + 1}의 최대 인원은 0보다 커야 합니다.`);
        return;
      }
    }

    try {
      setCreating(true);
      const eventDate = new Date(formData.date);
      
      await EventService.createEvent(
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          date: eventDate,
          location: formData.location.trim(),
          maxCapacity: parseInt(formData.maxCapacity),
          timeSlots: formData.timeSlots.map(slot => ({
            startTime: slot.startTime.trim(),
            endTime: slot.endTime.trim(),
            maxCapacity: parseInt(slot.maxCapacity),
          })),
        },
        user?.uid || ''
      );

       Alert.alert('성공', '이벤트가 성공적으로 생성되었습니다.');
       setShowCreateModal(false);
       resetForm();
       loadEvents();
    } catch (error) {
      console.error('이벤트 생성 오류:', error);
      Alert.alert('오류', '이벤트 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditEvent = (event: EventData) => {
    // 날짜를 YYYY-MM-DD 형식으로 변환
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toISOString().split('T')[0];
    
    setFormData({
      name: event.name,
      description: event.description,
      date: formattedDate,
      location: event.location,
      maxCapacity: event.maxCapacity.toString(),
      timeSlots: [], // 타임슬롯은 별도로 로드
    });
    
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    // 폼 검증
    if (!formData.name.trim()) {
      Alert.alert('오류', '이벤트 이름을 입력해주세요.');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('오류', '이벤트 설명을 입력해주세요.');
      return;
    }
    if (!formData.date.trim()) {
      Alert.alert('오류', '이벤트 날짜를 입력해주세요.');
      return;
    }
    if (!formData.location.trim()) {
      Alert.alert('오류', '이벤트 장소를 입력해주세요.');
      return;
    }
    if (!formData.maxCapacity.trim() || parseInt(formData.maxCapacity) <= 0) {
      Alert.alert('오류', '최대 인원을 입력해주세요.');
      return;
    }

    if (!editingEvent) {
      Alert.alert('오류', '수정할 이벤트 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      setUpdating(true);
      const eventDate = new Date(formData.date);
      
      await EventService.updateEvent(editingEvent.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: eventDate,
        location: formData.location.trim(),
        maxCapacity: parseInt(formData.maxCapacity),
      });

      Alert.alert('성공', '이벤트가 성공적으로 수정되었습니다.');
      setShowEditModal(false);
      setEditingEvent(null);
      resetForm();
      loadEvents();
    } catch (error) {
      console.error('이벤트 수정 오류:', error);
      Alert.alert('오류', '이벤트 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    console.log('=== 삭제 버튼 클릭됨 ===');
    console.log('이벤트 ID:', eventId);
    console.log('이벤트 이름:', eventName);
    console.log('현재 사용자:', user?.uid);
    console.log('사용자 프로필:', userProfile);
    console.log('사용자 이메일:', user?.email);
    
    // 관리자 권한 확인 (완화된 버전)
    if (user?.email === 'admin@test.com') {
      console.log('✅ admin@test.com 계정으로 관리자 권한 확인');
    } else if (userProfile?.role === 'admin') {
      console.log('✅ 프로필에서 관리자 권한 확인');
    } else {
      console.log('⚠️ 관리자 권한 확인 실패');
      Alert.alert('권한 오류', '관리자 권한이 필요합니다.');
      return;
    }
    
    // 삭제 대상 설정 및 Modal 표시
    setDeleteTarget({ id: eventId, name: eventName });
    setShowDeleteModal(true);
    console.log('삭제 확인 Modal 표시');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    console.log('사용자가 삭제를 확인했습니다.');
    try {
      console.log('=== 삭제 프로세스 시작 ===');
      console.log('1. 이벤트 ID:', deleteTarget.id);
      console.log('2. 이벤트 이름:', deleteTarget.name);
      console.log('3. 관리자 권한 확인됨');
      
      setDeleting(deleteTarget.id);
      
      // 이벤트 삭제 실행
      console.log('4. EventService.deleteEvent 호출 중...');
      await EventService.deleteEvent(deleteTarget.id);
      console.log('5. EventService.deleteEvent 완료');
      
      // 성공 처리
      console.log('6. 삭제 성공!');
      Alert.alert('성공', '이벤트가 삭제되었습니다.');
      loadEvents();
      
    } catch (error) {
      console.error('=== 삭제 오류 발생 ===');
      console.error('오류 타입:', typeof error);
      console.error('오류 메시지:', error instanceof Error ? error.message : '알 수 없는 오류');
      console.error('오류 코드:', error instanceof Error && 'code' in error ? (error as any).code : '알 수 없음');
      console.error('오류 스택:', error instanceof Error ? error.stack : '알 수 없음');
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      Alert.alert('오류', `이벤트 삭제에 실패했습니다.\n\n${errorMessage}`);
    } finally {
      console.log('7. 삭제 프로세스 종료');
      setDeleting(null);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  const cancelDelete = () => {
    console.log('사용자가 삭제를 취소했습니다.');
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };





  const getStatusText = (status: string) => {
    switch (status) {
      case 'upcoming': return '예정';
      case 'active': return '진행 중';
      case 'completed': return '완료';
      case 'cancelled': return '취소됨';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#007AFF';
      case 'active': return '#34C759';
      case 'completed': return '#8E8E93';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
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
           <View style={styles.headerLeft}>
             <Text style={styles.title}>이벤트 관리</Text>
             <Text style={styles.userInfo}>
               {user?.email} 
               {user?.email === 'admin@test.com' ? ' (관리자)' : ''}
             </Text>
           </View>
                                                                       <View style={styles.headerButtons}>
                <Button
                  title="새 이벤트 생성"
                  onPress={() => {
                    console.log('새 이벤트 생성 버튼 클릭됨');
                    setShowCreateModal(true);
                  }}
                  style={styles.createButton}
                />
              </View>
         </View>

        {/* 이벤트 목록 */}
        <View style={styles.eventsContainer}>
          {events.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>등록된 이벤트가 없습니다</Text>
              <Text style={styles.emptyStateSubtext}>
                새 이벤트를 생성하여 시작하세요
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(event.status)}</Text>
                  </View>
                </View>
                
                <Text style={styles.eventDescription}>{event.description}</Text>
                <Text style={styles.eventDate}>
                  날짜: {new Date(event.date).toLocaleDateString()}
                </Text>
                <Text style={styles.eventLocation}>장소: {event.location}</Text>
                <Text style={styles.eventCapacity}>최대 인원: {event.maxCapacity}명</Text>
                
                                 <View style={styles.eventActions}>
                                       <Button
                      title="수정"
                      onPress={() => {
                        console.log('수정 버튼 클릭됨:', event.id, event.name);
                        handleEditEvent(event);
                      }}
                      variant="outline"
                      style={styles.editButton}
                    />
                                        <Button
                       title={
                         deleting === event.id 
                           ? "삭제 중..." 
                           : "삭제"
                       }
                       onPress={() => {
                         console.log('=== 삭제 버튼 클릭 ===');
                         console.log('이벤트 ID:', event.id);
                         console.log('이벤트 이름:', event.name);
                         console.log('이벤트 상태:', event.status);
                         console.log('현재 사용자 권한:', userProfile?.role);
                         console.log('현재 사용자 이메일:', user?.email);
                         handleDeleteEvent(event.id, event.name);
                       }}
                       disabled={deleting === event.id}
                       variant="outline"
                       style={[
                         styles.deleteButton,
                         { opacity: deleting === event.id ? 0.6 : 1 }
                       ]}
                     />
                 </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 이벤트 생성 모달 */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>새 이벤트 생성</Text>
                                                   <Button
                title="취소"
                onPress={() => {
                  console.log('모달 닫기 버튼 클릭됨');
                  setShowCreateModal(false);
                  resetForm();
                }}
                variant="outline"
                style={styles.closeButton}
              />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* 이벤트 기본 정보 */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>이벤트 정보</Text>
              
              <TextInput
                style={styles.input}
                placeholder="이벤트 이름"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="이벤트 설명"
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />
              
                             <TextInput
                 style={styles.input}
                 placeholder="날짜 (YYYY-MM-DD)"
                 value={formData.date}
                 onChangeText={(text) => {
                   // 숫자와 하이픈만 허용
                   const cleaned = text.replace(/[^0-9-]/g, '');
                   
                   // 자동으로 하이픈 추가
                   let formatted = cleaned;
                   if (cleaned.length >= 4 && !cleaned.includes('-')) {
                     formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                   }
                   if (cleaned.length >= 7 && cleaned.split('-').length === 2) {
                     formatted = cleaned.slice(0, 7) + '-' + cleaned.slice(7);
                   }
                   
                   // 최대 10자까지만 입력 가능 (YYYY-MM-DD)
                   if (formatted.length <= 10) {
                     setFormData(prev => ({ ...prev, date: formatted }));
                   }
                 }}
                 keyboardType="numeric"
                 maxLength={10}
               />
              
              <TextInput
                style={styles.input}
                placeholder="장소"
                value={formData.location}
                onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
              />
              
              <TextInput
                style={styles.input}
                placeholder="최대 인원"
                value={formData.maxCapacity}
                onChangeText={(text) => setFormData(prev => ({ ...prev, maxCapacity: text }))}
                keyboardType="numeric"
              />
            </View>

                         {/* 타임슬롯 설정 */}
             <View style={styles.formSection}>
               <View style={styles.sectionHeader}>
                 <Text style={styles.sectionTitle}>타임슬롯 설정</Text>
                 <Button
                   title="타임슬롯 추가"
                   onPress={addTimeSlot}
                   variant="outline"
                   style={styles.addTimeSlotButton}
                 />
               </View>
               
               <Text style={styles.timeFormatNote}>
                 ⏰ 시간을 자유롭게 입력해주세요 (예: 오전 10시, 오후 2시, 14:30, 19:00 등)
               </Text>
              
              {formData.timeSlots.map((slot, index) => (
                <View key={index} style={styles.timeSlotForm}>
                  <View style={styles.timeSlotHeader}>
                    <Text style={styles.timeSlotTitle}>타임슬롯 {index + 1}</Text>
                    {formData.timeSlots.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeTimeSlot(index)}
                        style={styles.removeTimeSlotButton}
                      >
                        <Text style={styles.removeTimeSlotText}>삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                                     <View style={styles.timeSlotInputs}>
                     <TextInput
                       style={[styles.input, styles.timeInput]}
                       placeholder="시작 시간"
                       value={slot.startTime}
                       onChangeText={(text) => updateTimeSlot(index, 'startTime', text)}
                     />
                     <TextInput
                       style={[styles.input, styles.timeInput]}
                       placeholder="종료 시간"
                       value={slot.endTime}
                       onChangeText={(text) => updateTimeSlot(index, 'endTime', text)}
                     />
                     <TextInput
                       style={[styles.input, styles.capacityInput]}
                       placeholder="최대 인원"
                       value={slot.maxCapacity}
                       onChangeText={(text) => updateTimeSlot(index, 'maxCapacity', text)}
                       keyboardType="numeric"
                     />
                   </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
                                                   <Button
                title={creating ? "생성 중..." : "이벤트 생성"}
                onPress={() => {
                  console.log('이벤트 생성 버튼 클릭됨');
                  handleCreateEvent();
                }}
                disabled={creating}
                style={styles.createEventButton}
              />
          </View>
                 </SafeAreaView>
       </Modal>

       {/* 이벤트 수정 모달 */}
       <Modal
         visible={showEditModal}
         animationType="slide"
         presentationStyle="pageSheet"
       >
         <SafeAreaView style={styles.modalContainer}>
           <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>이벤트 수정</Text>
                                                       <Button
                 title="취소"
                 onPress={() => {
                   console.log('수정 모달 닫기 버튼 클릭됨');
                   setShowEditModal(false);
                   setEditingEvent(null);
                   resetForm();
                 }}
                 variant="outline"
                 style={styles.closeButton}
               />
           </View>

           <ScrollView style={styles.modalContent}>
             {/* 이벤트 기본 정보 */}
             <View style={styles.formSection}>
               <Text style={styles.sectionTitle}>이벤트 정보</Text>
               
               <TextInput
                 style={styles.input}
                 placeholder="이벤트 이름"
                 value={formData.name}
                 onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
               />
               
               <TextInput
                 style={[styles.input, styles.textArea]}
                 placeholder="이벤트 설명"
                 value={formData.description}
                 onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                 multiline
                 numberOfLines={3}
               />
               
               <TextInput
                 style={styles.input}
                 placeholder="날짜 (YYYY-MM-DD)"
                 value={formData.date}
                 onChangeText={(text) => {
                   // 숫자와 하이픈만 허용
                   const cleaned = text.replace(/[^0-9-]/g, '');
                   
                   // 자동으로 하이픈 추가
                   let formatted = cleaned;
                   if (cleaned.length >= 4 && !cleaned.includes('-')) {
                     formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                   }
                   if (cleaned.length >= 7 && cleaned.split('-').length === 2) {
                     formatted = cleaned.slice(0, 7) + '-' + cleaned.slice(7);
                   }
                   
                   // 최대 10자까지만 입력 가능 (YYYY-MM-DD)
                   if (formatted.length <= 10) {
                     setFormData(prev => ({ ...prev, date: formatted }));
                   }
                 }}
                 keyboardType="numeric"
                 maxLength={10}
               />
               
               <TextInput
                 style={styles.input}
                 placeholder="장소"
                 value={formData.location}
                 onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
               />
               
               <TextInput
                 style={styles.input}
                 placeholder="최대 인원"
                 value={formData.maxCapacity}
                 onChangeText={(text) => setFormData(prev => ({ ...prev, maxCapacity: text }))}
                 keyboardType="numeric"
               />
             </View>

             <Text style={styles.editNote}>
               💡 타임슬롯 수정은 TO 설정 탭에서 가능합니다.
             </Text>
           </ScrollView>

           <View style={styles.modalFooter}>
                                                       <Button
                 title={updating ? "수정 중..." : "이벤트 수정"}
                 onPress={() => {
                   console.log('이벤트 수정 버튼 클릭됨');
                   handleUpdateEvent();
                 }}
                 disabled={updating}
                 style={styles.createEventButton}
               />
           </View>
         </SafeAreaView>
       </Modal>

       {/* 이벤트 삭제 확인 모달 */}
       <Modal
         visible={showDeleteModal}
         animationType="fade"
         transparent={true}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.popupContainer}>
             <View style={styles.popupHeader}>
               <Text style={styles.popupTitle}>이벤트 삭제</Text>
             </View>
             <View style={styles.popupContent}>
               <Text style={styles.popupContentText}>
                 "{deleteTarget?.name}" 이벤트를 삭제하시겠습니까?
               </Text>
             </View>
             <View style={styles.popupFooter}>
               <Button
                 title="취소"
                 onPress={cancelDelete}
                 variant="danger"
                 textStyle={{ color: '#FFFFFF' }}
                 style={styles.popupCancelButton}
               />
               <Button
                 title={deleting === deleteTarget?.id ? "삭제 중..." : "삭제"}
                 onPress={confirmDelete}
                 disabled={deleting === deleteTarget?.id}
                 style={styles.popupDeleteButton}
               />
             </View>
           </View>
         </View>
       </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  userInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
     createButton: {
     backgroundColor: '#007AFF',
   },
               headerButtons: {
       flexDirection: 'row',
       gap: 8,
     },
  eventsContainer: {
    padding: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventCapacity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    borderColor: '#007AFF',
  },
  deleteButton: {
    flex: 1,
    borderColor: '#FF3B30',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
     closeButton: {
     paddingHorizontal: 16,
     paddingVertical: 8,
   },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalContentText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
     addTimeSlotButton: {
     borderColor: '#34C759',
   },
   timeFormatNote: {
     fontSize: 14,
     color: '#666',
     fontStyle: 'italic',
     marginBottom: 16,
     paddingHorizontal: 4,
   },
   editNote: {
     fontSize: 14,
     color: '#007AFF',
     fontStyle: 'italic',
     marginBottom: 16,
     paddingHorizontal: 4,
     textAlign: 'center',
   },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeSlotForm: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeSlotTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeTimeSlotButton: {
    padding: 4,
  },
  removeTimeSlotText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  timeSlotInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    flex: 1,
  },
  capacityInput: {
    flex: 1,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  createEventButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
  },
  refreshButton: {
    borderColor: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popupContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  popupHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  popupContent: {
    padding: 20,
    alignItems: 'center',
  },
  popupContentText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  popupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  popupCancelButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    color: '#FFFFFF',
  },
  popupDeleteButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
  },
});
