import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AdminService } from '../../services/adminService';
import { authService } from '../../services/authService';
import { deleteAllCompanionRecords } from '../../services/companionService';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';

interface OverallStats {
  totalEvents: number;
  activeEvents: number;
  totalQueued: number;
  totalCalled: number;
  totalEntered: number;
  faceRecognitionStats: {
    totalAttempts: number;
    successfulMatches: number;
    failedMatches: number;
    pendingReviews: number;
    successRate: number;
  };
}

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const overallStats = await AdminService.getOverallStats();
      setStats(overallStats);
    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleDeleteAllCompanionRecords = async () => {
    try {
      setLoading(true);
      await deleteAllCompanionRecords();
      await loadDashboardData(); // 대시보드 새로고침
    } catch (error) {
      console.error('동행자 기록 삭제 오류:', error);
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>관리자 대시보드</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 사용자 정보 */}
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>{currentUser?.email}</Text>
          <Text style={styles.userRole}>관리자</Text>
        </View>

        {/* 전체 통계 카드 */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>전체 통계</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.totalEvents || 0}</Text>
              <Text style={styles.statLabel}>전체 이벤트</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.activeEvents || 0}</Text>
              <Text style={styles.statLabel}>진행 중 이벤트</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.totalQueued || 0}</Text>
              <Text style={styles.statLabel}>대기 중</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.totalCalled || 0}</Text>
              <Text style={styles.statLabel}>호출됨</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats?.totalEntered || 0}</Text>
              <Text style={styles.statLabel}>입장 완료</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {stats?.faceRecognitionStats.pendingReviews || 0}
              </Text>
              <Text style={styles.statLabel}>검수 대기</Text>
            </View>
          </View>
        </View>

        {/* 얼굴 인식 통계 */}
        <View style={styles.faceRecognitionStats}>
          <Text style={styles.sectionTitle}>얼굴 인식 통계</Text>
          
          <View style={styles.faceStatsGrid}>
            <View style={styles.faceStatCard}>
              <Text style={styles.faceStatNumber}>
                {stats?.faceRecognitionStats.totalAttempts || 0}
              </Text>
              <Text style={styles.faceStatLabel}>총 시도</Text>
            </View>
            
            <View style={styles.faceStatCard}>
              <Text style={styles.faceStatNumber}>
                {stats?.faceRecognitionStats.successfulMatches || 0}
              </Text>
              <Text style={styles.faceStatLabel}>성공</Text>
            </View>
            
            <View style={styles.faceStatCard}>
              <Text style={styles.faceStatNumber}>
                {stats?.faceRecognitionStats.failedMatches || 0}
              </Text>
              <Text style={styles.faceStatLabel}>실패</Text>
            </View>
            
            <View style={styles.faceStatCard}>
              <Text style={styles.faceStatNumber}>
                {stats?.faceRecognitionStats.successRate.toFixed(1) || '0.0'}%
              </Text>
              <Text style={styles.faceStatLabel}>성공률</Text>
            </View>
          </View>
        </View>

        {/* 빠른 액션 버튼 */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>빠른 액션</Text>
          
          <View style={styles.actionButtons}>
            <Button
              title="이벤트 관리"
              onPress={() => {
                navigation.navigate('EventManagement' as never);
              }}
              style={styles.actionButton}
            />
            
            <Button
              title="TO 설정 관리"
              onPress={() => {
                navigation.navigate('TOManagement' as never);
              }}
              style={styles.actionButton}
            />
            
            <Button
              title="호출 현황 모니터링"
              onPress={() => {
                navigation.navigate('QueueMonitoring' as never);
              }}
              style={styles.actionButton}
            />
            
            <Button
              title="수동 검수 관리"
              onPress={() => {
                navigation.navigate('ManualReview' as never);
              }}
              style={styles.actionButton}
            />
          </View>
        </View>

        {/* 시스템 관리 */}
        <View style={styles.systemManagement}>
          <Text style={styles.sectionTitle}>시스템 관리</Text>
          
          <View style={styles.actionButtons}>
            <Button
              title="동행자 기록 전체 삭제"
              onPress={handleDeleteAllCompanionRecords}
              style={styles.dangerButton}
              variant="outline"
            />
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userEmail: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  faceRecognitionStats: {
    padding: 20,
    paddingTop: 0,
  },
  faceStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  faceStatCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
  faceStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  faceStatLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  quickActions: {
    padding: 20,
    paddingTop: 0,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
  },
  systemManagement: {
    padding: 20,
    paddingTop: 0,
  },
  dangerButton: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
});
