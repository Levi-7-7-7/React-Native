/**
 * RootNavigator — updated to handle student | tutor | unauthenticated
 *
 * Drop this file in place of src/navigation/RootNavigator.tsx
 */
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';

// Existing screens
import LoginScreen from '../screens/LoginScreen';
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import StudentTabNavigator from './StudentTabNavigator';
import LoadingScreen from '../screens/LoadingScreen';

// ── New tutor screens ──
import TutorLoginScreen from '../screens/TutorLoginScreen';
import TutorForgotPasswordScreen from '../screens/TutorForgotPasswordScreen';
import TutorTabNavigator from './TutorTabNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const {role, loading} = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {role === 'student' ? (
        // ── Student app ──
        <Stack.Screen name="StudentApp" component={StudentTabNavigator} />
      ) : role === 'tutor' ? (
        // ── Tutor app ──
        <Stack.Screen name="TutorApp" component={TutorTabNavigator} />
      ) : (
        // ── Auth screens ──
        <>
          {/* Student auth */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

          {/* Tutor auth */}
          <Stack.Screen name="TutorLogin" component={TutorLoginScreen} />
          <Stack.Screen
            name="TutorForgotPassword"
            component={TutorForgotPasswordScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
