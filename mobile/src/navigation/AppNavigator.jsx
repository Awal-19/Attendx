import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

import LoginScreen from '../screens/LoginScreen';
import StudentDashboardScreen from '../screens/student/StudentDashboardScreen';
import StudentScanScreen from '../screens/student/StudentScanScreen';
import StudentFaceScreen from '../screens/student/StudentFaceScreen';
import StudentHistoryScreen from '../screens/student/StudentHistoryScreen';

import LecturerDashboardScreen from '../screens/lecturer/LecturerDashboardScreen';
import LecturerLiveQRScreen from '../screens/lecturer/LecturerLiveQRScreen';
import LecturerHistoryScreen from '../screens/lecturer/LecturerHistoryScreen';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminAnnouncementsScreen from '../screens/admin/AdminAnnouncementsScreen';

import TimetableScreen from '../screens/shared/TimetableScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';

const Tab = createBottomTabNavigator();

const tabScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: COLORS.deepBlue,
    borderTopColor: COLORS.border,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarActiveTintColor: COLORS.uccRed,
  tabBarInactiveTintColor: COLORS.textMuted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  tabBarIcon: ({ color, size }) => {
    const icons = {
      Home: 'home-outline',
      Overview: 'grid-outline',
      Timetable: 'calendar-outline',
      ScanQR: 'qr-code-outline',
      FaceID: 'scan-outline',
      History: 'time-outline',
      LiveQR: 'radio-outline',
      Announce: 'megaphone-outline',
      Alerts: 'notifications-outline',
    };
    return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
  },
});

function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={StudentDashboardScreen} />
      <Tab.Screen name="Timetable" component={TimetableScreen} />
      <Tab.Screen name="ScanQR" component={StudentScanScreen} options={{ title: 'Scan QR' }} />
      <Tab.Screen name="FaceID" component={StudentFaceScreen} options={{ title: 'Face ID' }} />
      <Tab.Screen name="History" component={StudentHistoryScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}

function LecturerTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={LecturerDashboardScreen} />
      <Tab.Screen name="Timetable" component={TimetableScreen} />
      <Tab.Screen name="LiveQR" component={LecturerLiveQRScreen} options={{ title: 'Live QR' }} />
      <Tab.Screen name="History" component={LecturerHistoryScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Overview" component={AdminDashboardScreen} />
      <Tab.Screen name="Timetable" component={TimetableScreen} />
      <Tab.Screen name="Announce" component={AdminAnnouncementsScreen} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.skyBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === 'LECTURER' ? (
        <LecturerTabs />
      ) : user.role === 'ADMIN' || user.is_superuser ? (
        <AdminTabs />
      ) : (
        <StudentTabs />
      )}
    </NavigationContainer>
  );
}

