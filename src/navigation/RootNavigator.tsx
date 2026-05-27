/**
 * RootNavigator — uses UnifiedLoginScreen instead of separate
 * LoginScreen + TutorLoginScreen.
 *
 * src/navigation/RootNavigator.tsx
 */

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';

import UnifiedLoginScreen from '../screens/UnifiedLoginScreen';
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import TutorForgotPasswordScreen from '../screens/TutorForgotPasswordScreen';

import StudentTabNavigator from './StudentTabNavigator';
import TutorTabNavigator from './TutorTabNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import TutorProfileScreen from '../screens/TutorProfileScreen';
import TutorStudentDetailsScreen from '../screens/TutorStudentDetailsScreen';

import LoadingScreen from '../screens/LoadingScreen';

const Stack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator();

/**
 * StudentStackNavigator wraps the tab navigator with ProfileScreen on top.
 * This ensures ProfileScreen is a full-screen detail page with no tab bar.
 */
function StudentStackNavigator() {
  return (
    <StudentStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <StudentStack.Screen name="StudentTabs" component={StudentTabNavigator} />
      <StudentStack.Screen name="Profile" component={ProfileScreen} />
    </StudentStack.Navigator>
  );
}


/**
 * TutorStackNavigator wraps the tab navigator with TutorProfileScreen on top.
 */
function TutorStackNavigator() {
  return (
    <StudentStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <StudentStack.Screen name="TutorTabs"           component={TutorTabNavigator} />
      <StudentStack.Screen name="TutorProfile"        component={TutorProfileScreen} />
      <StudentStack.Screen name="TutorStudentDetails" component={TutorStudentDetailsScreen} />
    </StudentStack.Navigator>
  );
}

export default function RootNavigator() {
  const {role, loading} = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      {role === 'student' ? (
        <Stack.Screen
          name="StudentApp"
          component={StudentStackNavigator}
        />
      ) : role === 'tutor' ? (
        <Stack.Screen
          name="TutorApp"
          component={TutorStackNavigator}
        />
      ) : (
        <>
          {/* Unified Login */}
          <Stack.Screen
            name="Login"
            component={UnifiedLoginScreen}
          />

          {/* Student Flows */}
          <Stack.Screen
            name="VerifyOtp"
            component={VerifyOtpScreen}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />

          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
          />

          {/* Tutor Flows */}
          <Stack.Screen
            name="TutorForgotPassword"
            component={TutorForgotPasswordScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
