/**
 * AuthContext — fixed to restore tutor session from AsyncStorage
 * instead of pinging /tutors/me (which returns 404).
 *
 * Drop this in place of src/context/AuthContext.tsx
 */
import React, {createContext, useState, useEffect, useContext} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axiosInstance';
import tutorAxios from '../api/tutorAxios';

interface AuthContextType {
  user: any;
  setUser: (u: any) => void;
  role: string | null;
  setRole: (r: string | null) => void;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const init = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('role');

      if (storedRole === 'student') {
        const token = await AsyncStorage.getItem('token');

        if (token) {
          try {
            const res = await axiosInstance.get('/students/me');

            setUser(res.data);
            setRole('student');
          } catch (err: any) {
            if (err?.response?.status === 401) {
              await clearAll();
            } else {
              // Network/server issue — keep session
              setRole('student');
            }
          }
        }
      } else if (storedRole === 'tutor') {
        const token = await AsyncStorage.getItem('tutorToken');

        if (token) {
          try {
            // IMPORTANT:
            // keeps LoadingScreen visible during Render cold boot
            await tutorAxios.get('/tutors/students');

            const tutorName = await AsyncStorage.getItem('tutorName');

            setUser({name: tutorName || 'Tutor'});
            setRole('tutor');
          } catch (err: any) {
            if (err?.response?.status === 401) {
              await clearAll();
            } else {
              // Render sleeping/network issue
              // keep tutor logged in
              const tutorName = await AsyncStorage.getItem('tutorName');

              setUser({name: tutorName || 'Tutor'});
              setRole('tutor');
            }
          }
        }
      }
    } catch {
      await clearAll();
    } finally {
      setLoading(false);
    }
  };

  init();
}, []);

  const clearAll = async () => {
    await AsyncStorage.multiRemove([
      'token',
      'tutorToken',
      'adminToken',
      'role',
      'userName',
      'tutorName',
      'userData',
    ]);
  };

  const logout = async () => {
    await clearAll();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{user, setUser, role, setRole, loading, logout}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
