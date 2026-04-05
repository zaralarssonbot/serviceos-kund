import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BASE_URL } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [kund, setKund] = useState(null);
  const [laddar, setLaddar] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('kund_data');
        if (raw) setKund(JSON.parse(raw));
      } finally {
        setLaddar(false);
      }
    })();
  }, []);

  const loggaIn = useCallback(async (email, lösenord) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', lösenord);
    const r = await axios.post(`${BASE_URL}/api/auth/login`, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    await AsyncStorage.setItem('kund_token', r.data.access_token);
    const kundData = { email, ...r.data };
    await AsyncStorage.setItem('kund_data', JSON.stringify(kundData));
    setKund(kundData);
    return kundData;
  }, []);

  const loggaUt = useCallback(async () => {
    await AsyncStorage.multiRemove(['kund_token', 'kund_data']);
    setKund(null);
  }, []);

  return (
    <AuthContext.Provider value={{ kund, laddar, loggaIn, loggaUt }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
