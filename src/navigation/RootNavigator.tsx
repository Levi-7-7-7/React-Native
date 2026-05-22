import React from 'react';
import {StyleSheet} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import VerifyOtpScreen from '../screens/VerifyOtpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import StudentTabNavigator from './StudentTabNavigator';
import LoadingScreen from '../screens/LoadingScreen';
// import CertificateViewerScreen from '../screens/CertificateViewerScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const {role, loading} = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {role === 'student' ? (
        <>
          {/* Tab navigator lives at the root of the student stack */}
          <Stack.Screen name="StudentApp" component={StudentTabNavigator} />
          {/* In-app certificate viewer — pushed on top of tabs
          // <Stack.Screen
          //   name="CertificateViewer"
          //   component={CertificateViewerScreen}
          //   options={{animation: 'slide_from_bottom'}}
          // /> */}
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const styles = StyleSheet.create({});
