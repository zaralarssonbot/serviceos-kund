import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hämtaBokning, hämtaWorker, WS_URL } from '../lib/api';

const TEAL = '#1D9E75';

const STEG = [
  { status: 'OBOKAD',    etikett: 'Bokad',    ikon: '📋' },
  { status: 'TILLDELAD', etikett: 'På väg',   ikon: '🚗' },
  { status: 'PAGAENDE',  etikett: 'Anlänt',   ikon: '🏠' },
  { status: 'KLAR',      etikett: 'Pågår',    ikon: '🧹' },
  // KLAR är slutsteget
];

function ProgressBar({ status }) {
  const aktiv = STEG.findIndex(s => s.status === status);
  return (
    <View style={tr.progressContainer}>
      {STEG.map((steg, i) => (
        <View key={steg.status} style={{ alignItems: 'center', flex: 1 }}>
          <View style={[tr.progressPunkt, i <= aktiv && tr.progressPunktAktiv]}>
            <Text style={{ fontSize: 14 }}>{steg.ikon}</Text>
          </View>
          <Text style={[tr.progressText, i <= aktiv && { color: TEAL, fontWeight: '700' }]}>
            {steg.etikett}
          </Text>
          {i < STEG.length - 1 && (
            <View style={[tr.progressLinje, i < aktiv && tr.progressLinjeAktiv]} />
          )}
        </View>
      ))}
    </View>
  );
}

function WorkerKort({ worker, telefon, onRing, onSMS }) {
  return (
    <View style={tr.workerKort}>
      <View style={tr.workerAvatar}>
        <Text style={{ fontSize: 28 }}>👷</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tr.workerNamn}>
          {worker ? `${worker.fornamn} ${worker.efternamn}` : 'Tilldelar städare…'}
        </Text>
        {worker?.snittbetyg && (
          <Text style={tr.workerBetyg}>
            ⭐ {worker.snittbetyg.toFixed(1)} · {worker.antal_reviews ?? 0} recensioner
          </Text>
        )}
      </View>
      {worker && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={tr.kontaktBtn} onPress={onRing}>
            <Text style={{ fontSize: 20 }}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tr.kontaktBtn} onPress={onSMS}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function TrackingScreen({ navigation, route }) {
  const bokningId = route?.params?.bokningId;
  const [bokning, setBokning] = useState(null);
  const [worker, setWorker] = useState(null);
  const [workerPos, setWorkerPos] = useState(null);
  const [ansluten, setAnsluten] = useState(false);
  const [laddar, setLaddar] = useState(true);
  const wsRef = useRef(null);
  const reconnRef = useRef(null);
  const monterad = useRef(true);
  const kartRef = useRef(null);

  // Hämta initial bokningsdata
  useEffect(() => {
    if (!bokningId) return;
    (async () => {
      try {
        const b = await hämtaBokning(bokningId);
        setBokning(b);
        if (b.worker_id) {
          const w = await hämtaWorker(b.worker_id);
          setWorker(w);
        }
      } catch { /* tyst */ }
      finally { setLaddar(false); }
    })();
  }, [bokningId]);

  // WebSocket-anslutning
  const anslutWS = useCallback(async () => {
    if (!monterad.current || !bokningId) return;
    const token = await AsyncStorage.getItem('kund_token');
    if (!token) return;

    const ws = new WebSocket(
      `${WS_URL}/api/ws/kund/${bokningId}?token=${encodeURIComponent(token)}`
    );
    wsRef.current = ws;

    ws.onopen = () => { if (monterad.current) setAnsluten(true); };

    ws.onmessage = (e) => {
      if (!monterad.current) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'position' && data.lat && data.lng) {
          const pos = { latitude: data.lat, longitude: data.lng };
          setWorkerPos(pos);
          kartRef.current?.animateToRegion({ ...pos, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
        }
        if (data.type === 'status_update') {
          setBokning(prev => prev ? { ...prev, status: data.status } : prev);
          if (data.worker_id && !worker) {
            hämtaWorker(data.worker_id).then(setWorker).catch(() => {});
          }
        }
        if (data.type === 'klar') {
          Alert.alert(
            'Städningen är klar! 🎉',
            'Vänligen lämna en recension.',
            [
              { text: 'Lämna recension', onPress: () => navigation.navigate('Historik') },
              { text: 'Stäng', style: 'cancel' },
            ]
          );
        }
      } catch { /* ignorera parse-fel */ }
    };

    ws.onclose = (e) => {
      if (!monterad.current) return;
      setAnsluten(false);
      if (e.code !== 1000) {
        reconnRef.current = setTimeout(() => anslutWS(), 4000);
      }
    };

    ws.onerror = () => { if (monterad.current) setAnsluten(false); };
  }, [bokningId]);

  useEffect(() => {
    monterad.current = true;
    anslutWS();
    return () => {
      monterad.current = false;
      clearTimeout(reconnRef.current);
      wsRef.current?.close(1000, 'Skärm stängd');
    };
  }, [anslutWS]);

  async function hanteraRing() {
    if (!worker?.telefon) return;
    Linking.openURL(`tel:${worker.telefon}`);
  }

  async function hanteraSMS() {
    const tillgänglig = await SMS.isAvailableAsync();
    if (tillgänglig && worker?.telefon) {
      await SMS.sendSMSAsync([worker.telefon], 'Hej! Jag är kunden för din nuvarande städning.');
    } else {
      Alert.alert('SMS ej tillgängligt på denna enhet');
    }
  }

  const startRegion = workerPos
    ? { ...workerPos, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 59.3293, longitude: 18.0686, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  if (laddar) {
    return (
      <SafeAreaView style={tr.safe}>
        <ActivityIndicator size="large" color={TEAL} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!bokningId) {
    return (
      <SafeAreaView style={tr.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#6B7280' }}>Ingen aktiv bokning</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Karta */}
      <MapView
        ref={kartRef}
        style={tr.karta}
        provider={PROVIDER_GOOGLE}
        initialRegion={startRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {workerPos && (
          <Marker coordinate={workerPos} title="Din städare">
            <View style={tr.städarMarker}>
              <Text style={{ fontSize: 22 }}>🧹</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Live-indikator */}
      <View style={tr.liveBadge}>
        <View style={[tr.livePunkt, !ansluten && { backgroundColor: '#EF4444' }]} />
        <Text style={tr.liveText}>{ansluten ? 'Live' : 'Ansluter…'}</Text>
      </View>

      {/* Tillbaka-knapp */}
      <TouchableOpacity style={tr.backBtn} onPress={() => navigation.goBack()}>
        <Text style={{ fontSize: 16, color: '#1A1A2E' }}>‹</Text>
      </TouchableOpacity>

      {/* Bottenkort */}
      <SafeAreaView edges={['bottom']} style={tr.bottenKort}>
        {/* Status-rubrik */}
        <View style={tr.statusRad}>
          <Text style={tr.statusText}>
            {bokning?.status === 'TILLDELAD' ? '🚗 Din städare är på väg' :
             bokning?.status === 'PAGAENDE'  ? '🧹 Städning pågår' :
             bokning?.status === 'KLAR'      ? '✅ Städning klar!' :
             '📋 Bokning bekräftad'}
          </Text>
          <Text style={tr.bokningId}>#{bokningId?.toString().slice(0, 8)}</Text>
        </View>

        {/* Progress */}
        <ProgressBar status={bokning?.status} />

        {/* Worker-info */}
        <WorkerKort
          worker={worker}
          onRing={hanteraRing}
          onSMS={hanteraSMS}
        />
      </SafeAreaView>
    </View>
  );
}

const tr = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  karta: { flex: 1 },
  liveBadge: {
    position: 'absolute', top: 56, right: 16,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, elevation: 4,
  },
  livePunkt: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL,
  },
  liveText: { fontSize: 12, fontWeight: '700', color: '#1A1A2E' },
  backBtn: {
    position: 'absolute', top: 48, left: 16,
    backgroundColor: '#fff', borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, elevation: 4,
  },
  städarMarker: {
    backgroundColor: '#fff', borderRadius: 24, padding: 6,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, elevation: 6,
    borderWidth: 2, borderColor: TEAL,
  },
  bottenKort: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, elevation: 10,
  },
  statusRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusText: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  bokningId: { fontSize: 12, color: '#9CA3AF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  progressContainer: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  progressPunkt: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  progressPunktAktiv: { backgroundColor: TEAL + '20', borderColor: TEAL },
  progressText: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  progressLinje: {
    position: 'absolute', top: 17, right: -4, width: '100%', height: 2,
    backgroundColor: '#E5E7EB', zIndex: -1,
  },
  progressLinjeAktiv: { backgroundColor: TEAL },
  workerKort: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 8,
  },
  workerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: TEAL + '20', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: TEAL + '40',
  },
  workerNamn: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  workerBetyg: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  kontaktBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
});
