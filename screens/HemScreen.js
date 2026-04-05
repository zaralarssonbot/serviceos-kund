import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { hämtaMinaBokningar } from '../lib/api';

const TEAL = '#1D9E75';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY'; // Byt till riktig nyckel

const TJÄNSTER = [
  { id: 'STADNING', etikett: 'Hemstädning', ikon: '🏠', färg: '#EFF6FF', kantfärg: '#BFDBFE' },
  { id: 'OMSORG',   etikett: 'Kontorsstädning', ikon: '🏢', färg: '#F0FDF4', kantfärg: '#BBF7D0' },
  { id: 'LOGISTIK', etikett: 'Flyttstädning', ikon: '📦', färg: '#FFF7ED', kantfärg: '#FED7AA' },
];

const STATUS_ETIKETT = {
  OBOKAD: 'Obokad', TILLDELAD: 'Tilldelad', PAGAENDE: 'Pågående',
  KLAR: 'Klar', FAKTURERAD: 'Fakturerad', BETALD: 'Betald',
};
const STATUS_FÄRG = {
  OBOKAD: '#6B7280', TILLDELAD: '#3B82F6', PAGAENDE: '#F59E0B',
  KLAR: '#10B981', FAKTURERAD: '#8B5CF6', BETALD: '#10B981',
};

function KampanjBanner() {
  return (
    <View style={s.banner}>
      <Text style={s.bannerEmoji}>🎉</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.bannerRubrik}>50% RUT-avdrag</Text>
        <Text style={s.bannerSub}>Spara upp till 37 500 kr/år på städning</Text>
      </View>
      <Text style={s.bannerPil}>›</Text>
    </View>
  );
}

function TjänstKort({ tjänst, vald, onVälj }) {
  return (
    <TouchableOpacity
      style={[s.tjänstKort, { backgroundColor: tjänst.färg, borderColor: vald ? TEAL : tjänst.kantfärg }]}
      onPress={() => onVälj(tjänst.id)}
      activeOpacity={0.7}
    >
      <Text style={s.tjänstIkon}>{tjänst.ikon}</Text>
      <Text style={[s.tjänstText, vald && { color: TEAL, fontWeight: '700' }]}>{tjänst.etikett}</Text>
    </TouchableOpacity>
  );
}

function BokningRad({ bokning, onTryck }) {
  return (
    <TouchableOpacity style={s.bokningRad} onPress={() => onTryck(bokning)} activeOpacity={0.7}>
      <View style={s.bokningIkon}>
        <Text style={{ fontSize: 20 }}>
          {bokning.typ === 'STADNING' ? '🏠' : bokning.typ === 'OMSORG' ? '🏢' : '📦'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.bokningTyp}>{STATUS_ETIKETT[bokning.status] ?? bokning.typ}</Text>
        <Text style={s.bokningDatum}>
          {bokning.startdatum ? new Date(bokning.startdatum).toLocaleDateString('sv-SE', {
            weekday: 'short', month: 'short', day: 'numeric',
          }) : '—'}
        </Text>
      </View>
      <View style={[s.statusBadge, { backgroundColor: (STATUS_FÄRG[bokning.status] ?? '#6B7280') + '20' }]}>
        <Text style={[s.statusText, { color: STATUS_FÄRG[bokning.status] ?? '#6B7280' }]}>
          {STATUS_ETIKETT[bokning.status] ?? bokning.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HemScreen({ navigation }) {
  const { kund } = useAuth();
  const [vald, setVald] = useState(null);
  const [bokningar, setBokningar] = useState([]);
  const [laddar, setLaddar] = useState(false);
  const [adress, setAdress] = useState('');
  const sökRef = useRef(null);

  const hämtaBokningar = useCallback(async () => {
    if (!kund?.id) return;
    setLaddar(true);
    try {
      const data = await hämtaMinaBokningar(kund.id);
      setBokningar(data.slice(0, 5));
    } catch {
      // tyst fel — visa tomt
    } finally {
      setLaddar(false);
    }
  }, [kund?.id]);

  useEffect(() => { hämtaBokningar(); }, [hämtaBokningar]);

  function hanteraTjänstVälj(id) {
    setVald(id);
    navigation.navigate('Boka', { typ: id, adress });
  }

  function hanteraBokningstryck(bokning) {
    if (bokning.status === 'TILLDELAD' || bokning.status === 'PAGAENDE') {
      navigation.navigate('Tracking', { bokningId: bokning.id });
    } else {
      navigation.navigate('Historik');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hälsning */}
        <View style={s.hälsning}>
          <Text style={s.hälsningText}>
            Hej{kund?.fornamn ? ` ${kund.fornamn}` : ''}! 👋
          </Text>
          <Text style={s.tagline}>Var vill du städa idag?</Text>
        </View>

        {/* Sökruta */}
        <View style={s.sökContainer}>
          <GooglePlacesAutocomplete
            ref={sökRef}
            placeholder="Ange din adress…"
            onPress={(data) => setAdress(data.description)}
            query={{ key: GOOGLE_API_KEY, language: 'sv', components: 'country:se|country:no|country:fi|country:dk' }}
            styles={{
              container: { flex: 0 },
              textInput: s.sökInput,
              listView: s.sökLista,
              row: { paddingVertical: 12, paddingHorizontal: 16 },
              description: { fontSize: 15, color: '#1A1A2E' },
            }}
            fetchDetails={false}
            enablePoweredByContainer={false}
            debounce={300}
            renderLeftButton={() => <Text style={s.sökIkon}>📍</Text>}
          />
        </View>

        {/* Kampanjbanner */}
        <KampanjBanner />

        {/* Snabbval tjänster */}
        <Text style={s.sektionRubrik}>Välj tjänst</Text>
        <View style={s.tjänsterRad}>
          {TJÄNSTER.map(t => (
            <TjänstKort key={t.id} tjänst={t} vald={vald === t.id} onVälj={hanteraTjänstVälj} />
          ))}
        </View>

        {/* Boka-knapp */}
        <TouchableOpacity
          style={s.bokaBtnStorl}
          onPress={() => navigation.navigate('Boka', { typ: vald, adress })}
          activeOpacity={0.85}
        >
          <Text style={s.bokaBtnText}>Boka städning</Text>
          <Text style={{ fontSize: 18 }}>→</Text>
        </TouchableOpacity>

        {/* Senaste bokningar */}
        {(laddar || bokningar.length > 0) && (
          <>
            <Text style={[s.sektionRubrik, { marginTop: 28 }]}>Senaste bokningar</Text>
            {laddar ? (
              <ActivityIndicator color={TEAL} style={{ marginTop: 12 }} />
            ) : (
              <View style={s.bokningLista}>
                {bokningar.map(b => (
                  <BokningRad key={b.id} bokning={b} onTryck={hanteraBokningstryck} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  hälsning: { marginTop: 16, marginBottom: 20 },
  hälsningText: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  tagline: { fontSize: 15, color: '#6B7280', marginTop: 2 },
  sökContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  sökInput: {
    fontSize: 16, color: '#1A1A2E', backgroundColor: 'transparent',
    paddingLeft: 0, height: 48,
  },
  sökIkon: { fontSize: 18, paddingLeft: 12, paddingTop: 14 },
  sökLista: { borderRadius: 12, marginTop: 4, elevation: 4 },
  banner: {
    backgroundColor: TEAL + '15',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: TEAL + '30',
  },
  bannerEmoji: { fontSize: 28, marginRight: 12 },
  bannerRubrik: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  bannerSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  bannerPil: { fontSize: 22, color: TEAL, fontWeight: '700' },
  sektionRubrik: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  tjänsterRad: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tjänstKort: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  tjänstIkon: { fontSize: 28, marginBottom: 6 },
  tjänstText: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  bokaBtnStorl: {
    backgroundColor: TEAL,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  bokaBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  bokningLista: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  bokningRad: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  bokningIkon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F0FBF7', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  bokningTyp: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  bokningDatum: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
});
