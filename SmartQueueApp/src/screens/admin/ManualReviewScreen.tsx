import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminService } from '../../services/adminService';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { ManualReviewQueue } from '../../services/faceRecognitionService';

export const ManualReviewScreen: React.FC = () => {
  const [reviewQueue, setReviewQueue] = useState<ManualReviewQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadReviewQueue();
  }, []);

  const loadReviewQueue = async () => {
    try {
      setLoading(true);
      const queue = await AdminService.getManualReviewQueue();
      setReviewQueue(queue);
    } catch (error) {
      console.error('검수 대기열 로드 오류:', error);
      Alert.alert('오류', '검수 대기열을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviewQueue();
    setRefreshing(false);
  };

  const handleReview = async (reviewId: string, status: 'approved' | 'rejected') => {
    try {
      setProcessing(reviewId);
      
      const currentUser = await import('../../services/authService').then(
        (module) => module.authService.getCurrentUser()
      );
      
      if (!currentUser) {
        Alert.alert('오류', '사용자 정보를 찾을 수 없습니다.');
        return;
      }

      await AdminService.updateManualReview(reviewId, status, currentUser.uid);
      
      // 로컬 상태 업데이트
      setReviewQueue(prev => prev.filter(item => item.id !== reviewId));
      
      Alert.alert(
        '성공',
        status === 'approved' ? '승인되었습니다.' : '거부되었습니다.'
      );
    } catch (error) {
      console.error('검수 처리 오류:', error);
      Alert.alert('오류', '검수 처리를 하는데 실패했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return '#34C759';
    if (confidence >= 0.5) return '#FF9500';
    return '#ff6b6b';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.7) return '높음';
    if (confidence >= 0.5) return '보통';
    return '낮음';
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
          <Text style={styles.title}>수동 검수 관리</Text>
          <View style={styles.queueInfo}>
            <Text style={styles.queueCount}>대기 중: {reviewQueue.length}건</Text>
          </View>
        </View>

        {/* 검수 대기열 */}
        {reviewQueue.length > 0 ? (
          <View style={styles.reviewList}>
            {reviewQueue.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                {/* 사용자 정보 */}
                <View style={styles.userInfo}>
                  <Text style={styles.userId}>사용자 ID: {review.userId}</Text>
                  <Text style={styles.ticketId}>티켓 ID: {review.ticketId}</Text>
                </View>

                {/* 얼굴 인식 신뢰도 */}
                <View style={styles.confidenceSection}>
                  <Text style={styles.confidenceLabel}>얼굴 인식 신뢰도</Text>
                  <View style={styles.confidenceInfo}>
                    <Text
                      style={[
                        styles.confidenceValue,
                        { color: getConfidenceColor(review.confidence) },
                      ]}
                    >
                      {(review.confidence * 100).toFixed(1)}%
                    </Text>
                    <Text
                      style={[
                        styles.confidenceText,
                        { color: getConfidenceColor(review.confidence) },
                      ]}
                    >
                      ({getConfidenceText(review.confidence)})
                    </Text>
                  </View>
                </View>

                {/* 이미지 비교 */}
                <View style={styles.imageComparison}>
                  <Text style={styles.imageLabel}>이미지 비교</Text>
                  <View style={styles.imageRow}>
                    <View style={styles.imageContainer}>
                      <Text style={styles.imageTitle}>프로필 이미지</Text>
                      <Image
                        source={{ uri: review.profileImageUrl }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    </View>
                    
                    <View style={styles.imageContainer}>
                      <Text style={styles.imageTitle}>티켓 이미지</Text>
                      <Image
                        source={{ uri: review.ticketImageUrl }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                </View>

                {/* 검수 액션 */}
                <View style={styles.actionButtons}>
                  <Button
                    title="승인"
                    onPress={() => handleReview(review.id, 'approved')}
                    loading={processing === review.id}
                    disabled={processing !== null}
                    style={styles.approveButton}
                  />
                  
                  <Button
                    title="거부"
                    onPress={() => handleReview(review.id, 'rejected')}
                    loading={processing === review.id}
                    disabled={processing !== null}
                    style={styles.rejectButton}
                  />
                </View>

                {/* 생성 시간 */}
                <View style={styles.createdAt}>
                  <Text style={styles.createdAtText}>
                    요청 시간: {review.createdAt.toLocaleString('ko-KR')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              검수 대기 중인 항목이 없습니다.
            </Text>
            <Text style={styles.emptyStateSubtext}>
              얼굴 인식이 실패한 티켓이 있으면 여기에 표시됩니다.
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
    marginBottom: 8,
  },
  queueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueCount: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  reviewList: {
    padding: 20,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userId: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  ticketId: {
    fontSize: 12,
    color: '#666',
  },
  confidenceSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  confidenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imageComparison: {
    marginBottom: 16,
  },
  imageLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  imageTitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  approveButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#34C759',
  },
  rejectButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#ff6b6b',
  },
  createdAt: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  createdAtText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
