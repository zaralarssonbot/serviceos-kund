import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const BASE_URL = 'https://web-production-5e7b9.up.railway.app';
export const WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('kund_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('kund_token');
      await AsyncStorage.removeItem('kund_data');
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Jobb ────────────────────────────────────────────────────────────────────

export async function skapaBokning(data) {
  const r = await api.post('/api/jobb', data);
  return r.data;
}

export async function hämtaBokning(jobbId) {
  const r = await api.get(`/api/jobb/${jobbId}`);
  return r.data;
}

export async function hämtaMinaBokningar(kundId) {
  const r = await api.get('/api/jobb', { params: { kund_id: kundId, limit: 50 } });
  return r.data?.items ?? r.data ?? [];
}

// ── Betalning ────────────────────────────────────────────────────────────────

export async function skapaPaymentIntent(jobbId) {
  const r = await api.post(`/api/betalningar/payment-intent/${jobbId}`);
  return r.data;
}

// ── Kunder ───────────────────────────────────────────────────────────────────

export async function hämtaKund(kundId) {
  const r = await api.get(`/api/kunder/${kundId}`);
  return r.data;
}

export async function uppdateraKund(kundId, data) {
  const r = await api.patch(`/api/kunder/${kundId}`, data);
  return r.data;
}

// ── Workers ──────────────────────────────────────────────────────────────────

export async function hämtaWorker(workerId) {
  const r = await api.get(`/api/workers/${workerId}`);
  return r.data;
}
