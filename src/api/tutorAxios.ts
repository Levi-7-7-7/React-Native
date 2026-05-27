import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://final-project-backend-ucwn.onrender.com/api';

const tutorAxios = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

tutorAxios.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('tutorToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

tutorAxios.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['tutorToken', 'tutorName', 'role']);
    }
    return Promise.reject(err);
  },
);

export default tutorAxios;
