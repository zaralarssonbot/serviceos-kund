import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const BASE_URL = 'https://web-production-5e7b9.up.railway.app';

const NYCKLAR = { token: 'kund_token', refresh: 'kund_refresh', data: 'kund_data' };
export { NYCKLAR };

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(NYCKLAR.token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Utloggningslyssnare — AuthContext registrerar sig så att ett dött refresh-token
// skickar kunden till inloggningen i stället för att appen hänger kvar.
let påUtloggad = null;
export function sättUtloggadLyssnare(fn) { påUtloggad = fn; }

let pågåendeRefresh = null;

async function förnyaToken() {
  const refresh = await AsyncStorage.getItem(NYCKLAR.refresh);
  if (!refresh) throw new Error('Inget refresh-token');
  const r = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refresh }, { timeout: 15000 });
  await AsyncStorage.multiSet([
    [NYCKLAR.token, r.data.access_token],
    [NYCKLAR.refresh, r.data.refresh_token],
  ]);
  return r.data.access_token;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && original && !original._försökt) {
      original._försökt = true;
      try {
        pågåendeRefresh = pågåendeRefresh ?? förnyaToken();
        const token = await pågåendeRefresh;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(Object.values(NYCKLAR));
        påUtloggad?.();
      } finally {
        pågåendeRefresh = null;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

/** Läsbart felmeddelande från ett axios-fel (FastAPI `detail` kan vara sträng eller lista). */
export function felText(err, reserv = 'Något gick fel. Försök igen.') {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  if (err?.message === 'Network Error') return 'Ingen kontakt med servern. Kontrollera din uppkoppling.';
  return reserv;
}

// ── Publik config (Google Places- och Stripe-nyckel från backend) ───────────

let configCache = null;
export async function hämtaConfig() {
  if (configCache) return configCache;
  try {
    const r = await axios.get(`${BASE_URL}/api/bokningar/config`, { timeout: 10000 });
    configCache = {
      googleMapsKey: r.data?.google_maps_api_key || '',
      stripeKey: r.data?.stripe_publishable_key || '',
    };
  } catch {
    return { googleMapsKey: '', stripeKey: '' }; // cachas inte — försök igen nästa gång
  }
  return configCache;
}

// ── Inloggning (SMS-kod — loggar in befintlig kund eller skapar ny) ─────────

export async function skickaKod(telefon) {
  const r = await axios.post(`${BASE_URL}/api/auth/skicka-kod`, { telefon }, { timeout: 15000 });
  return r.data; // { skickat, maskerat_nummer, dev_kod? }
}

export async function verifieraKod(telefon, kod) {
  const r = await axios.post(`${BASE_URL}/api/auth/verifiera-kod`, { telefon, kod }, { timeout: 15000 });
  return r.data; // { access_token, refresh_token, kund_id, telefon, ny_kund, villkor_godkanda }
}

export async function godkännVillkor() {
  const r = await api.post('/api/auth/godkann-villkor');
  return r.data;
}

// ── Profil ──────────────────────────────────────────────────────────────────

export async function hämtaProfil() {
  const r = await api.get('/api/kunder/mig');
  return r.data;
}

export async function uppdateraProfil(data) {
  const r = await api.patch('/api/kunder/mig', data);
  return r.data;
}

// ── Bokningar (samma flöde som webbens /boka) ───────────────────────────────

export async function skapaBokning(data) {
  const r = await api.post('/api/bokningar/skapa', data);
  return r.data; // { booking_id, pris, rut_avdrag, belopp_att_betala, tjanst_namn, ... }
}

export async function hämtaMinaBokningar() {
  const r = await api.get('/api/bokningar/mina');
  return { kommande: r.data?.kommande ?? [], tidigare: r.data?.tidigare ?? [] };
}

export async function hämtaBokning(id) {
  const r = await api.get(`/api/bokningar/${id}`);
  return r.data;
}

export async function hämtaStatus(id) {
  const r = await api.get(`/api/bokningar/${id}/status`);
  return r.data;
}

export async function avbokaBokning(id) {
  const r = await api.post(`/api/bokningar/${id}/avboka`);
  return r.data;
}

export async function betygsättBokning(id, betyg, kommentar) {
  const r = await api.post(`/api/bokningar/${id}/betygsatt`, { betyg, kommentar: kommentar || null });
  return r.data;
}

// ── Betalning ───────────────────────────────────────────────────────────────

export async function skapaPaymentIntent(id) {
  const r = await api.post(`/api/bokningar/${id}/betala-pi`);
  return r.data; // { client_secret, belopp_att_betala, pris, rut_avdrag }
}
