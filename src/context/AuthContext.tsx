import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, {invalidateStudentTokenCache} from '../api/axiosInstance';
import tutorAxios, {invalidateTutorTokenCache} from '../api/tutorAxios';

interface AuthContextType {
  user: any;
  setUser: (u: any) => void;
  role: string | null;
  setRole: (r: string | null) => void;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const STORAGE_KEYS = ['token', 'tutorToken', 'adminToken', 'role', 'userName', 'tutorName', 'userData'];

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Prevent double-init in StrictMode
  const initRan = useRef(false);

  const clearAll = useCallback(async () => {
    invalidateStudentTokenCache();
    invalidateTutorTokenCache();
    await AsyncStorage.multiRemove(STORAGE_KEYS);
  }, []);

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

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
                // Network/server issue — keep session alive
                setRole('student');
              }
            }
          }
        } else if (storedRole === 'tutor') {
          const token = await AsyncStorage.getItem('tutorToken');
          if (token) {
            try {
              await tutorAxios.get('/tutors/students');
              const tutorName = await AsyncStorage.getItem('tutorName');
              setUser({name: tutorName || 'Tutor'});
              setRole('tutor');
            } catch (err: any) {
              if (err?.response?.status === 401) {
                await clearAll();
              } else {
                // Render sleeping/network issue — keep tutor logged in
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
  }, [clearAll]);

  const logout = useCallback(async () => {
    await clearAll();
    setUser(null);
    setRole(null);
  }, [clearAll]);

  return (
    <AuthContext.Provider value={{user, setUser, role, setRole, loading, logout}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
