/**
 * RootNavigator — uses UnifiedLoginScreen instead of separate
 * LoginScreen + TutorLoginScreen.
 *
 * Drop this in place of src/navigation/RootNavigator.tsx
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
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const {role, loading} = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {role === 'student' ? (
        <Stack.Screen name="StudentApp" component={StudentTabNavigator} />
      ) : role === 'tutor' ? (
        <Stack.Screen name="TutorApp" component={TutorTabNavigator} />
      ) : (
        <>
          {/* Single unified login — handles both students and tutors */}
          <Stack.Screen name="Login" component={UnifiedLoginScreen} />

          {/* Student flows */}
          <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

          {/* Tutor flows */}
          <Stack.Screen name="TutorForgotPassword" component={TutorForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
