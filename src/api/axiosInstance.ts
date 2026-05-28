import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://final-project-backend-ucwn.onrender.com/api';

// ── Token cache (avoids AsyncStorage read on every request) ────────────────
let _cachedToken: string | null | undefined = undefined; // undefined = not loaded yet

async function getStudentToken(): Promise<string | null> {
  if (_cachedToken !== undefined) return _cachedToken;
  _cachedToken = await AsyncStorage.getItem('token');
  return _cachedToken;
}

export function invalidateStudentTokenCache() {
  _cachedToken = undefined;
}

// ── Axios instance ─────────────────────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use(async config => {
  const token = await getStudentToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      _cachedToken = null;
      await AsyncStorage.multiRemove(['token', 'userData', 'userName', 'role']);
    }
    return Promise.reject(err);
  },
);

export default axiosInstance;
