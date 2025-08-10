import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);

  const profileSections = [
    {
      title: '계정 정보',
      items: [
        { label: '이름', value: user?.displayName || '사용자' },
        { label: '이메일', value: user?.email || 'user@example.com' },
        { label: '가입일', value: '2024-12-01' },
      ],
    },
    {
      title: '알림 설정',
      items: [
        {
          label: '앱 알림',
          type: 'switch',
          value: notificationsEnabled,
          onValueChange: setNotificationsEnabled,
        },
        {
          label: '푸시 알림',
          type: 'switch',
          value: pushNotificationsEnabled,
          onValueChange: setPushNotificationsEnabled,
        },
        {
          label: '이메일 알림',
          type: 'switch',
          value: emailNotificationsEnabled,
          onValueChange: setEmailNotificationsEnabled,
        },
      ],
    },
    {
      title: '대기열 정보',
      items: [
        { label: '현재 대기열', value: '아이유 콘서트 2024 (10:00-11:00)' },
        { label: '대기 순번', value: '15번' },
        { label: '예상 대기 시간', value: '약 30분' },
      ],
    },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const renderProfileItem = (item: any, index: number) => {
    if (item.type === 'switch') {
      return (
        <View key={index} style={styles.profileItem}>
          <Text style={styles.profileLabel}>{item.label}</Text>
          <Switch
            value={item.value}
            onValueChange={item.onValueChange}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
            thumbColor={item.value ? '#FFFFFF' : '#FFFFFF'}
          />
        </View>
      );
    }

    return (
      <View key={index} style={styles.profileItem}>
        <Text style={styles.profileLabel}>{item.label}</Text>
        <Text style={styles.profileValue}>{item.value}</Text>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      bounces={true}
    >
      <View style={styles.header}>
        <View style={styles.profileImage}>
          <Text style={styles.profileInitial}>
            {user?.displayName?.charAt(0) || 'U'}
          </Text>
        </View>
        <Text style={styles.profileName}>
          {user?.displayName || '사용자'}
        </Text>
        <Text style={styles.profileEmail}>
          {user?.email || 'user@example.com'}
        </Text>
      </View>

      <View style={styles.sections}>
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) =>
                renderProfileItem(item, itemIndex)
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <Button
          title="프로필 편집"
          onPress={() => {
            // TODO: 프로필 편집 화면으로 이동
            alert('프로필 편집 기능은 추후 구현 예정입니다.');
          }}
          style={styles.editButton}
        />
        
        <Button
          title="로그아웃"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>버전 1.0.0</Text>
        <TouchableOpacity>
          <Text style={styles.helpText}>도움말</Text>
        </TouchableOpacity>
      </View>

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
    paddingBottom: 100, // 하단 패딩 추가
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#8E8E93',
  },
  sections: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  profileLabel: {
    fontSize: 16,
    color: '#000000',
  },
  profileValue: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  helpText: {
    fontSize: 14,
    color: '#007AFF',
  },
  backButtonContainer: {
    padding: 20,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5EA',
    borderWidth: 1,
  },
});
