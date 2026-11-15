import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  NYCKLAR, hämtaProfil, sättUtloggadLyssnare, uppdateraProfil, verifieraKod,
} from '../lib/api';

const AuthContext = createContext(null);

/**
 * `kund` = profilen från GET /api/kunder/mig:
 * { kund_id, fornamn, efternamn, email, telefon, gatuadress, postnummer, stad,
 *   har_personnummer, villkor_godkanda }
 */
export function AuthProvider({ children }) {
  const [kund, setKund] = useState(null);
  const [laddar, setLaddar] = useState(true);

  const sparaKund = useCallback(async (data) => {
    setKund(data);
    if (data) await AsyncStorage.setItem(NYCKLAR.data, JSON.stringify(data));
  }, []);

  const loggaUt = useCallback(async () => {
    await AsyncStorage.multiRemove(Object.values(NYCKLAR));
    setKund(null);
  }, []);

  useEffect(() => {
    sättUtloggadLyssnare(() => setKund(null));
    (async () => {
      try {
        const token = await AsyncStorage.getItem(NYCKLAR.token);
        if (!token) return;
        // Visa sparad profil direkt, uppdatera i bakgrunden.
        const raw = await AsyncStorage.getItem(NYCKLAR.data);
        if (raw) setKund(JSON.parse(raw));
        try {
          await sparaKund(await hämtaProfil());
        } catch (e) {
          if (e?.response?.status === 401 || e?.response?.status === 403) await loggaUt();
        }
      } finally {
        setLaddar(false);
      }
    })();
    return () => sättUtloggadLyssnare(null);
  }, [sparaKund, loggaUt]);

  /** Steg 2 i inloggningen. Returnerar { ny_kund, profil } så att LoginScreen kan be om namn. */
  const loggaInMedKod = useCallback(async (telefon, kod) => {
    const svar = await verifieraKod(telefon, kod);
    await AsyncStorage.multiSet([
      [NYCKLAR.token, svar.access_token],
      [NYCKLAR.refresh, svar.refresh_token],
    ]);
    const profil = await hämtaProfil();
    return { svar, profil };
  }, []);

  /** Släpper in kunden i appen (anropas när ev. namn-steget är klart). */
  const slutförInloggning = useCallback(async (profil) => {
    await sparaKund(profil);
  }, [sparaKund]);

  const uppdatera = useCallback(async (data) => {
    const profil = await uppdateraProfil(data);
    await sparaKund(profil);
    return profil;
  }, [sparaKund]);

  const laddaOmProfil = useCallback(async () => {
    try { await sparaKund(await hämtaProfil()); } catch { /* behåll cache */ }
  }, [sparaKund]);

  return (
    <AuthContext.Provider
      value={{ kund, laddar, loggaInMedKod, slutförInloggning, uppdatera, laddaOmProfil, loggaUt }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
