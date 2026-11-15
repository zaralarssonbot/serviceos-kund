import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from '../lib/karta';
import { felText, hämtaBokning, hämtaStatus } from '../lib/api';
import { TEAL } from '../lib/tjanster';

const POLL_MS = 10000;
const STEG = ['Tilldelad', 'På väg', 'Framme', 'Städar', 'Klar'];

function Stegindikator({ stage }) {
  return (
    <View style={tr.stegRad}>
      {STEG.map((namn, i) => {
        const klar = i < stage;
        return (
          <View key={namn} style={{ alignItems: 'center', flex: 1 }}>
            <View style={[tr.prick, klar && tr.prickKlar]} />
            <Text style={[tr.stegText, klar && { color: TEAL, fontWeight: '700' }]}>{namn}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Följer en bokning via GET /api/bokningar/{id}/status (pollas var 10:e s).
 * Backend visar bara riktig data — utan tilldelad städare är `worker` null.
 */
export default function TrackingScreen({ navigation, route }) {
  const bokningId = route?.params?.bokningId;
  const [status, setStatus] = useState(null);
  const [bokning, setBokning] = useState(null);
  const [fel, setFel] = useState('');
  const timer = useRef(null);

  const hämta = useCallback(async () => {
    try {
      setStatus(await hämtaStatus(bokningId));
      setFel('');
    } catch (e) {
      setFel(felText(e, 'Kunde inte hämta status.'));
    }
  }, [bokningId]);

  useEffect(() => {
    if (!bokningId) return undefined;
    hämtaBokning(bokningId).then(setBokning).catch(() => {});
    hämta();
    timer.current = setInterval(hämta, POLL_MS);
    return () => clearInterval(timer.current);
  }, [bokningId, hämta]);

  useEffect(() => {
    if (status?.is_done) clearInterval(timer.current);
  }, [status?.is_done]);

  const kund = status?.kund_lat != null && status?.kund_lng != null
    ? { latitude: status.kund_lat, longitude: status.kund_lng } : null;
  const städarPos = status?.worker_start_lat != null && status?.worker_start_lng != null
    ? { latitude: status.worker_start_lat, longitude: status.worker_start_lng } : null;
  const worker = status?.worker;

  const region = kund ? {
    ...kund,
    latitudeDelta: städarPos ? Math.max(Math.abs(kund.latitude - städarPos.latitude) * 2.5, 0.01) : 0.01,
    longitudeDelta: städarPos ? Math.max(Math.abs(kund.longitude - städarPos.longitude) * 2.5, 0.01) : 0.01,
  } : null;

  return (
    <View style={tr.container}>
      {region ? (
        <MapView style={StyleSheet.absoluteFill} region={region}>
          <Marker coordinate={kund} title="Din adress" pinColor={TEAL} />
          {städarPos && <Marker coordinate={städarPos} title={worker?.namn ?? 'Städaren'}><Text style={{ fontSize: 28 }}>🧹</Text></Marker>}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, tr.kartaSaknas]}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
        </View>
      )}

      <SafeAreaView edges={['top']} style={tr.topp}>
        <TouchableOpacity style={tr.tillbaka} onPress={() => navigation.goBack()} accessibilityLabel="Tillbaka">
          <Text style={{ fontSize: 18 }}>‹</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <View style={tr.panel}>
        {!status && !fel && <ActivityIndicator color={TEAL} />}
        {!!fel && <Text style={tr.fel}>{fel}</Text>}
        {status && (
          <>
            <Text style={tr.rubrik}>{status.stage_namn}</Text>
            {status.eta_minuter > 0 && <Text style={tr.eta}>Beräknad ankomst om ca {status.eta_minuter} min</Text>}
            {bokning && <Text style={tr.sub}>{bokning.tjanst_namn} · {bokning.datum_formaterat} kl {bokning.tid}</Text>}
            {worker ? (
              <>
                <Stegindikator stage={status.stage} />
                <View style={tr.städare}>
                  <View style={tr.avatar}><Text style={{ fontSize: 22 }}>🧑‍🔧</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={tr.namn}>{worker.namn}{worker.verifierad ? '  ✓' : ''}</Text>
                    <Text style={tr.sub}>
                      {worker.betyg ? `★ ${worker.betyg}` : 'Ny städare'}
                      {worker.antal_stadningar ? ` · ${worker.antal_stadningar} städningar` : ''}
                    </Text>
                  </View>
                  {!!worker.telefon && (
                    <TouchableOpacity style={tr.ring} onPress={() => Linking.openURL(`tel:${worker.telefon}`)}>
                      <Text style={tr.ringText}>📞 Ring</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <Text style={[tr.sub, { marginTop: 10 }]}>
                Vi letar upp en ledig städare nära dig. Sidan uppdateras automatiskt.
              </Text>
            )}
            {status.is_done && (
              <TouchableOpacity style={tr.klarBtn} onPress={() => navigation.navigate('Historik')}>
                <Text style={tr.klarText}>★ Betygsätt städningen</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const tr = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },
  kartaSaknas: { alignItems: 'center', justifyContent: 'center' },
  topp: { position: 'absolute', top: 0, left: 16 },
  tillbaka: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', marginTop: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  rubrik: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  eta: { fontSize: 15, color: TEAL, fontWeight: '700', marginTop: 4 },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 19 },
  fel: { color: '#DC2626' },
  stegRad: { flexDirection: 'row', marginTop: 18 },
  prick: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E7EB', marginBottom: 6 },
  prickKlar: { backgroundColor: TEAL },
  stegText: { fontSize: 11, color: '#9CA3AF' },
  städare: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0FBF7', alignItems: 'center', justifyContent: 'center' },
  namn: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  ring: { backgroundColor: TEAL + '15', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  ringText: { color: TEAL, fontWeight: '700' },
  klarBtn: { backgroundColor: TEAL, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 18 },
  klarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
