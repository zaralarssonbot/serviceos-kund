import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { Marker } from '../lib/karta';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const TEAL = '#1D9E75';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY';

const TJÄNSTER = [
  { id: 'STADNING', etikett: 'Hemstädning', ikon: '🏠' },
  { id: 'OMSORG',   etikett: 'Kontorsstädning', ikon: '🏢' },
  { id: 'LOGISTIK', etikett: 'Flyttstädning', ikon: '📦' },
];

const STORLEKAR = [
  { id: 'liten', etikett: 'Litet (< 50 m²)', baspris: 690 },
  { id: 'medel', etikett: 'Medel (50–100 m²)', baspris: 990 },
  { id: 'stort', etikett: 'Stort (> 100 m²)', baspris: 1390 },
];

const TIDER = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'];

function VäljarKort({ vald, onVälj, alternativ, fältNyckel = 'id', etikettNyckel = 'etikett', ikonNyckel = 'ikon' }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {alternativ.map(a => (
        <TouchableOpacity
          key={a[fältNyckel]}
          onPress={() => onVälj(a)}
          activeOpacity={0.7}
          style={[
            sk.val,
            vald?.[fältNyckel] === a[fältNyckel] && sk.valVald,
          ]}
        >
          {ikonNyckel && a[ikonNyckel] && <Text style={{ fontSize: 18, marginRight: 6 }}>{a[ikonNyckel]}</Text>}
          <Text style={[sk.valText, vald?.[fältNyckel] === a[fältNyckel] && sk.valTextVald]}>
            {a[etikettNyckel]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PrisSummering({ tjänst, storlek, rutAvdrag }) {
  if (!storlek) return null;
  const brutto = storlek.baspris;
  const rut = rutAvdrag ? Math.min(brutto * 0.5, 37500 / 12) : 0;
  const netto = brutto - rut;
  return (
    <View style={sk.prisKort}>
      <Text style={sk.prisRubrik}>Prisöversikt</Text>
      <View style={sk.prisRad}>
        <Text style={sk.prisEtikett}>Pris</Text>
        <Text style={sk.prisSiffra}>{brutto.toLocaleString('sv-SE')} kr</Text>
      </View>
      {rutAvdrag && (
        <View style={sk.prisRad}>
          <Text style={[sk.prisEtikett, { color: TEAL }]}>RUT-avdrag (50%)</Text>
          <Text style={[sk.prisSiffra, { color: TEAL }]}>–{Math.round(rut).toLocaleString('sv-SE')} kr</Text>
        </View>
      )}
      <View style={[sk.prisRad, { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4 }]}>
        <Text style={[sk.prisEtikett, { fontWeight: '700', fontSize: 16 }]}>Du betalar</Text>
        <Text style={[sk.prisSiffra, { fontSize: 20, color: TEAL, fontWeight: '800' }]}>
          {Math.round(netto).toLocaleString('sv-SE')} kr
        </Text>
      </View>
    </View>
  );
}

export default function BokningScreen({ navigation, route }) {
  const { kund } = useAuth();
  const [tjänst, setTjänst] = useState(
    TJÄNSTER.find(t => t.id === route?.params?.typ) ?? null
  );
  const [storlek, setStorlek] = useState(null);
  const [datum, setDatum] = useState(null);
  const [tid, setTid] = useState(null);
  const [adress, setAdress] = useState(route?.params?.adress ?? '');
  const [koordinat, setKoordinat] = useState(null);
  const [rutAvdrag, setRutAvdrag] = useState(true);
  const [laddar, setLaddar] = useState(false);

  // Generera de 7 nästa dagarna
  const dagar = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  async function hanteraBokning() {
    if (!tjänst || !storlek || !datum || !tid || !adress) {
      Alert.alert('Ofullständig bokning', 'Fyll i alla fält för att fortsätta.');
      return;
    }
    if (!kund?.id) {
      Alert.alert('Inte inloggad');
      return;
    }
    setLaddar(true);
    try {
      const startdatum = new Date(datum);
      const [h, m] = tid.split(':');
      startdatum.setHours(parseInt(h), parseInt(m), 0, 0);

      const jobb = await api.post('/api/jobb', {
        kund_id: kund.id,
        typ: tjänst.id,
        startdatum: startdatum.toISOString(),
        pris_exkl_moms: storlek.baspris,
        rut_avdrag: rutAvdrag ? Math.min(storlek.baspris * 0.5, 3125) : null,
        noteringar: adress,
      });
      navigation.navigate('Betalning', { jobb: jobb.data, rutAvdrag });
    } catch (err) {
      Alert.alert('Fel', err?.response?.data?.detail ?? 'Kunde inte skapa bokning');
    } finally {
      setLaddar(false);
    }
  }

  return (
    <SafeAreaView style={sk.safe}>
      <ScrollView
        contentContainerStyle={sk.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={sk.rubrik}>Boka städning</Text>

        {/* Tjänst */}
        <Text style={sk.sektion}>Välj tjänst</Text>
        <VäljarKort alternativ={TJÄNSTER} vald={tjänst} onVälj={setTjänst} />

        {/* Storlek */}
        <Text style={sk.sektion}>Bostadens storlek</Text>
        <VäljarKort alternativ={STORLEKAR} vald={storlek} onVälj={setStorlek} ikonNyckel={null} />

        {/* Datum */}
        <Text style={sk.sektion}>Välj datum</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
            {dagar.map(d => {
              const vald = datum?.toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  onPress={() => setDatum(d)}
                  style={[sk.dagKort, vald && sk.dagKortVald]}
                >
                  <Text style={[sk.dagVecka, vald && { color: '#fff' }]}>
                    {d.toLocaleDateString('sv-SE', { weekday: 'short' })}
                  </Text>
                  <Text style={[sk.dagSiffra, vald && { color: '#fff' }]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[sk.dagMånad, vald && { color: '#ffffffbb' }]}>
                    {d.toLocaleDateString('sv-SE', { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Tid */}
        <Text style={sk.sektion}>Välj tid</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {TIDER.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTid(t)}
              style={[sk.tidKort, tid === t && sk.tidKortVald]}
            >
              <Text style={[sk.tidText, tid === t && { color: '#fff' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Adress + Karta */}
        <Text style={sk.sektion}>Adress</Text>
        <View style={sk.sökContainer}>
          <GooglePlacesAutocomplete
            placeholder="Ange städadress…"
            onPress={(data, details) => {
              setAdress(data.description);
              if (details?.geometry?.location) {
                setKoordinat({
                  latitude: details.geometry.location.lat,
                  longitude: details.geometry.location.lng,
                });
              }
            }}
            query={{ key: GOOGLE_API_KEY, language: 'sv', components: 'country:se|country:no|country:fi|country:dk' }}
            fetchDetails
            enablePoweredByContainer={false}
            debounce={300}
            styles={{ textInput: sk.sökInput, listView: { borderRadius: 12 } }}
          />
        </View>

        {koordinat && (
          <MapView
            style={sk.karta}
            region={{ ...koordinat, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
            scrollEnabled={false}
          >
            <Marker coordinate={koordinat} title="Städadress" pinColor={TEAL} />
          </MapView>
        )}

        {/* RUT-avdrag */}
        <TouchableOpacity
          style={sk.rutRad}
          onPress={() => setRutAvdrag(r => !r)}
          activeOpacity={0.7}
        >
          <View style={[sk.checkbox, rutAvdrag && sk.checkboxVald]}>
            {rutAvdrag && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sk.rutText}>Använd RUT-avdrag</Text>
            <Text style={sk.rutSub}>50% rabatt via Skatteverket (max 75 000 kr/år)</Text>
          </View>
        </TouchableOpacity>

        {/* Prisöversikt */}
        <PrisSummering tjänst={tjänst} storlek={storlek} rutAvdrag={rutAvdrag} />

        {/* Boka-knapp */}
        <TouchableOpacity
          style={[sk.bokaBtn, laddar && { opacity: 0.6 }]}
          onPress={hanteraBokning}
          disabled={laddar}
          activeOpacity={0.85}
        >
          {laddar
            ? <ActivityIndicator color="#fff" />
            : <Text style={sk.bokaBtnText}>Fortsätt till betalning →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sk = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 24 },
  sektion: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 24, marginBottom: 12 },
  val: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 2, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1,
  },
  valVald: { borderColor: TEAL, backgroundColor: TEAL + '10' },
  valText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  valTextVald: { color: TEAL },
  dagKort: {
    width: 64, borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB',
  },
  dagKortVald: { backgroundColor: TEAL, borderColor: TEAL },
  dagVecka: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  dagSiffra: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginVertical: 2 },
  dagMånad: { fontSize: 11, color: '#6B7280' },
  tidKort: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB',
  },
  tidKortVald: { backgroundColor: TEAL, borderColor: TEAL },
  tidText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  sökContainer: {
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#E5E7EB', zIndex: 5,
  },
  sökInput: { fontSize: 15, color: '#1A1A2E', backgroundColor: 'transparent', height: 48 },
  karta: { height: 180, borderRadius: 16, marginTop: 14, overflow: 'hidden' },
  rutRad: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  checkboxVald: { backgroundColor: TEAL, borderColor: TEAL },
  rutText: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  rutSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  prisKort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  prisRubrik: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },
  prisRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prisEtikett: { fontSize: 14, color: '#6B7280' },
  prisSiffra: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  bokaBtn: {
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    marginTop: 28, shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  bokaBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
