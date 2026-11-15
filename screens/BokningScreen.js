import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { Marker } from '../lib/karta';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { felText, hämtaConfig, skapaBokning } from '../lib/api';
import {
  STORLEKAR, TEAL, TIDER, TJÄNSTER, beräknaPris, giltigtPersonnummer, isoDatum, kr, tjänstInfo,
} from '../lib/tjanster';

const ANTAL_DAGAR = 14;

/** Plockar ut gatuadress/postnummer/ort ur ett Google Places details-svar. */
function tolkaPlace(details) {
  const komp = details?.address_components ?? [];
  const hitta = (typ) => komp.find((c) => c.types?.includes(typ))?.long_name ?? '';
  const gata = [hitta('route'), hitta('street_number')].filter(Boolean).join(' ');
  return {
    gatuadress: gata || (details?.name ?? ''),
    postnummer: hitta('postal_code'),
    stad: hitta('postal_town') || hitta('locality') || hitta('administrative_area_level_2'),
    lat: details?.geometry?.location?.lat ?? null,
    lng: details?.geometry?.location?.lng ?? null,
  };
}

export default function BokningScreen({ navigation, route }) {
  const { kund, laddaOmProfil } = useAuth();
  const [config, setConfig] = useState(null);

  const [tjänst, setTjänst] = useState(
    TJÄNSTER.some((t) => t.id === route?.params?.tjanst) ? route.params.tjanst : null
  );
  const [storlek, setStorlek] = useState(null);
  const [datum, setDatum] = useState(null);
  const [tid, setTid] = useState(null);
  const [adress, setAdress] = useState({
    gatuadress: kund?.gatuadress ?? '', postnummer: kund?.postnummer ?? '',
    stad: kund?.stad ?? '', lat: null, lng: null,
  });
  const [instruktioner, setInstruktioner] = useState('');
  const [vilRut, setVilRut] = useState(true);
  const [personnummer, setPersonnummer] = useState('');
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(false);

  useEffect(() => { hämtaConfig().then(setConfig); }, []);

  // Tjänst förvald från Hem-fliken
  useEffect(() => {
    const t = route?.params?.tjanst;
    if (t && TJÄNSTER.some((x) => x.id === t)) setTjänst(t);
  }, [route?.params?.tjanst]);

  const dagar = useMemo(() => Array.from({ length: ANTAL_DAGAR }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i + 1);
    return d;
  }), []);

  const rutTjänst = tjänst ? tjänstInfo(tjänst).rut : false;
  const harPnr = !!kund?.har_personnummer;
  const nyttPnrGiltigt = giltigtPersonnummer(personnummer);
  const fårRut = rutTjänst && vilRut && (harPnr || nyttPnrGiltigt);
  const pris = tjänst && storlek ? beräknaPris(tjänst, storlek, fårRut) : null;

  function sättAdressFält(fält, värde) {
    // Manuell ändring → koordinaten gäller inte längre, geokodas om vid bokning.
    setAdress((a) => ({ ...a, [fält]: värde, lat: null, lng: null }));
  }

  async function säkerställKoordinat() {
    if (adress.lat != null && adress.lng != null) return adress;
    try {
      const träffar = await Location.geocodeAsync(`${adress.gatuadress}, ${adress.postnummer} ${adress.stad}, Sverige`);
      if (träffar?.[0]) {
        const med = { ...adress, lat: träffar[0].latitude, lng: träffar[0].longitude };
        setAdress(med);
        return med;
      }
    } catch { /* utan koordinat bokas jobbet ändå — matchningen faller tillbaka på adress */ }
    return adress;
  }

  async function boka() {
    if (!tjänst) return setFel('Välj vilken tjänst du vill boka.');
    if (!storlek) return setFel('Välj bostadens storlek.');
    if (!datum || !tid) return setFel('Välj datum och tid.');
    if (!adress.gatuadress.trim() || !adress.postnummer.trim() || !adress.stad.trim()) {
      return setFel('Fyll i hela adressen (gata, postnummer och ort).');
    }
    if (rutTjänst && vilRut && !harPnr && !nyttPnrGiltigt) {
      return setFel('Ange ett giltigt personnummer för RUT-avdrag, eller stäng av RUT.');
    }
    if (!kund?.fornamn || !kund?.email) {
      return setFel('Fyll i namn och e-post under Profil innan du bokar.');
    }
    setFel(''); setLaddar(true);
    try {
      const a = await säkerställKoordinat();
      const svar = await skapaBokning({
        gatuadress: a.gatuadress.trim(),
        postnummer: a.postnummer.trim(),
        stad: a.stad.trim(),
        lat: a.lat, lng: a.lng,
        tjanst: tjänst,
        storlek,
        datum: isoDatum(datum),
        tid,
        fornamn: kund.fornamn,
        efternamn: kund.efternamn || '-',
        email: kund.email,
        telefon: kund.telefon,
        personnummer: rutTjänst && vilRut && !harPnr ? personnummer.trim() : null,
        specialinstruktioner: instruktioner.trim() || null,
      });
      laddaOmProfil(); // adress + ev. personnummer sparas på kunden av backend
      setPersonnummer('');
      navigation.navigate('Betalning', { bokning: { ...svar, gatuadress: a.gatuadress, stad: a.stad } });
    } catch (e) {
      setFel(felText(e, 'Kunde inte skapa bokningen.'));
    } finally {
      setLaddar(false);
    }
  }

  const googleKey = config?.googleMapsKey;

  return (
    <SafeAreaView style={sk.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={sk.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={sk.rubrik}>Boka städning</Text>

          <Text style={sk.sektion}>Tjänst</Text>
          <View style={sk.rutnät}>
            {TJÄNSTER.map((t) => (
              <TouchableOpacity key={t.id} onPress={() => setTjänst(t.id)} activeOpacity={0.7}
                style={[sk.val, sk.valHalv, tjänst === t.id && sk.valVald]}>
                <Text style={{ fontSize: 18, marginRight: 6 }}>{t.ikon}</Text>
                <Text style={[sk.valText, tjänst === t.id && sk.valTextVald]}>{t.etikett}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={sk.sektion}>Storlek</Text>
          <View style={sk.rutnät}>
            {STORLEKAR.map((st) => {
              const p = tjänst ? beräknaPris(tjänst, st.id, false)?.pris : null;
              return (
                <TouchableOpacity key={st.id} onPress={() => setStorlek(st.id)} activeOpacity={0.7}
                  style={[sk.val, sk.valHalv, sk.valKolumn, storlek === st.id && sk.valVald]}>
                  <Text style={[sk.valText, storlek === st.id && sk.valTextVald]}>{st.etikett}</Text>
                  {p != null && <Text style={sk.valPris}>{kr(p)}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={sk.sektion}>Datum</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
              {dagar.map((d) => {
                const vald = datum && isoDatum(datum) === isoDatum(d);
                return (
                  <TouchableOpacity key={isoDatum(d)} onPress={() => setDatum(d)} style={[sk.dagKort, vald && sk.dagKortVald]}>
                    <Text style={[sk.dagVecka, vald && { color: '#fff' }]}>
                      {d.toLocaleDateString('sv-SE', { weekday: 'short' })}
                    </Text>
                    <Text style={[sk.dagSiffra, vald && { color: '#fff' }]}>{d.getDate()}</Text>
                    <Text style={[sk.dagMånad, vald && { color: '#ffffffbb' }]}>
                      {d.toLocaleDateString('sv-SE', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Text style={sk.sektion}>Tid</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {TIDER.map((t) => (
              <TouchableOpacity key={t} onPress={() => setTid(t)} style={[sk.tidKort, tid === t && sk.tidKortVald]}>
                <Text style={[sk.tidText, tid === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={sk.sektion}>Adress</Text>
          {googleKey ? (
            <View style={sk.sökContainer}>
              <GooglePlacesAutocomplete
                placeholder="Sök adress…"
                fetchDetails
                onPress={(_, details) => setAdress(tolkaPlace(details))}
                query={{ key: googleKey, language: 'sv', components: 'country:se', types: 'address' }}
                GooglePlacesDetailsQuery={{ fields: 'address_components,geometry,name' }}
                enablePoweredByContainer={false}
                debounce={300}
                minLength={3}
                keyboardShouldPersistTaps="handled"
                disableScroll
                styles={{ textInput: sk.sökInput, listView: { borderRadius: 12 } }}
              />
            </View>
          ) : null}
          <TextInput style={sk.input} placeholder="Gatuadress" value={adress.gatuadress}
            onChangeText={(v) => sättAdressFält('gatuadress', v)} autoComplete="street-address" placeholderTextColor="#9CA3AF" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput style={[sk.input, { flex: 2, minWidth: 0 }]} placeholder="Postnr" value={adress.postnummer}
              onChangeText={(v) => sättAdressFält('postnummer', v)} keyboardType="number-pad"
              autoComplete="postal-code" placeholderTextColor="#9CA3AF" />
            <TextInput style={[sk.input, { flex: 3, minWidth: 0 }]} placeholder="Ort" value={adress.stad}
              onChangeText={(v) => sättAdressFält('stad', v)} placeholderTextColor="#9CA3AF" />
          </View>

          {adress.lat != null && adress.lng != null && (
            <MapView style={sk.karta} scrollEnabled={false} zoomEnabled={false}
              region={{ latitude: adress.lat, longitude: adress.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }}>
              <Marker coordinate={{ latitude: adress.lat, longitude: adress.lng }} title="Städadress" pinColor={TEAL} />
            </MapView>
          )}

          <Text style={sk.sektion}>Något städaren bör veta? (valfritt)</Text>
          <TextInput style={[sk.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline
            placeholder="Portkod, nyckel, husdjur, fokus på badrum…" value={instruktioner}
            onChangeText={setInstruktioner} placeholderTextColor="#9CA3AF" />

          {rutTjänst && (
            <View style={sk.rutKort}>
              <TouchableOpacity style={sk.rutRad} onPress={() => setVilRut((r) => !r)} activeOpacity={0.7}>
                <View style={[sk.checkbox, vilRut && sk.checkboxVald]}>
                  {vilRut && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sk.rutText}>RUT-avdrag – halva priset</Text>
                  <Text style={sk.rutSub}>Vi drar 50 % direkt och ansöker hos Skatteverket.</Text>
                </View>
              </TouchableOpacity>
              {vilRut && !harPnr && (
                <>
                  <TextInput style={[sk.input, { marginTop: 12, marginBottom: 4 }]}
                    placeholder="Personnummer (ÅÅÅÅMMDD-XXXX)" value={personnummer}
                    onChangeText={setPersonnummer} keyboardType="number-pad" maxLength={13}
                    placeholderTextColor="#9CA3AF" />
                  <Text style={sk.rutSub}>
                    {personnummer && !nyttPnrGiltigt
                      ? 'Kontrollera personnumret.'
                      : 'Krävs av Skatteverket för RUT. Sparas krypterat.'}
                  </Text>
                </>
              )}
              {vilRut && harPnr && <Text style={[sk.rutSub, { marginTop: 8 }]}>✓ Personnummer finns sparat.</Text>}
            </View>
          )}

          {pris && (
            <View style={sk.prisKort}>
              <View style={sk.prisRad}>
                <Text style={sk.prisEtikett}>Pris inkl. moms</Text>
                <Text style={sk.prisSiffra}>{kr(pris.pris)}</Text>
              </View>
              {pris.rut > 0 && (
                <View style={sk.prisRad}>
                  <Text style={[sk.prisEtikett, { color: TEAL }]}>RUT-avdrag (50 %)</Text>
                  <Text style={[sk.prisSiffra, { color: TEAL }]}>–{kr(pris.rut)}</Text>
                </View>
              )}
              <View style={[sk.prisRad, sk.prisTotal]}>
                <Text style={[sk.prisEtikett, { fontWeight: '700', fontSize: 16, color: '#1A1A2E' }]}>Du betalar</Text>
                <Text style={[sk.prisSiffra, { fontSize: 20, color: TEAL, fontWeight: '800' }]}>{kr(pris.att_betala)}</Text>
              </View>
            </View>
          )}

          {!!fel && <Text style={sk.fel}>{fel}</Text>}

          <TouchableOpacity style={[sk.bokaBtn, laddar && { opacity: 0.6 }]} onPress={boka} disabled={laddar} activeOpacity={0.85}>
            {laddar ? <ActivityIndicator color="#fff" /> : <Text style={sk.bokaBtnText}>Boka och gå till betalning →</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const sk = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 16 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  sektion: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 22, marginBottom: 12 },
  rutnät: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  val: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  valHalv: { width: '48%' },
  valKolumn: { flexDirection: 'column', alignItems: 'flex-start' },
  valVald: { borderColor: TEAL, backgroundColor: TEAL + '10' },
  valText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  valTextVald: { color: TEAL },
  valPris: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  dagKort: {
    width: 64, borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB',
  },
  dagKortVald: { backgroundColor: TEAL, borderColor: TEAL },
  dagVecka: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase' },
  dagSiffra: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginVertical: 2 },
  dagMånad: { fontSize: 11, color: '#6B7280' },
  tidKort: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB',
  },
  tidKortVald: { backgroundColor: TEAL, borderColor: TEAL },
  tidText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  sökContainer: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 4, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', zIndex: 5,
  },
  sökInput: { fontSize: 15, color: '#1A1A2E', backgroundColor: 'transparent', height: 46 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 10, color: '#1A1A2E',
  },
  karta: { height: 160, borderRadius: 16, marginTop: 4, overflow: 'hidden' },
  rutKort: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 22, borderWidth: 1.5, borderColor: '#E5E7EB' },
  rutRad: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  prisRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prisTotal: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, marginTop: 4, marginBottom: 0 },
  prisEtikett: { fontSize: 14, color: '#6B7280' },
  prisSiffra: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  fel: { color: '#DC2626', fontSize: 14, marginTop: 16, textAlign: 'center' },
  bokaBtn: {
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    marginTop: 20, shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  bokaBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
