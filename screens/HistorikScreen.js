import { useCallback, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from '../lib/alert';
import { avbokaBokning, betygsättBokning, felText, hämtaMinaBokningar } from '../lib/api';
import { STATUS_FÄRG, TEAL, kr, tjänstInfo } from '../lib/tjanster';

const SPÅRBARA = new Set(['tilldelad', 'pa_vag', 'framme', 'pagar']);

function BetygModal({ bokning, onStäng, onSparad }) {
  const [betyg, setBetyg] = useState(5);
  const [kommentar, setKommentar] = useState('');
  const [sparar, setSparar] = useState(false);

  async function spara() {
    setSparar(true);
    try {
      await betygsättBokning(bokning.booking_id, betyg, kommentar.trim());
      onSparad();
    } catch (e) {
      Alert.alert('Kunde inte spara', felText(e));
    } finally {
      setSparar(false);
    }
  }

  return (
    <Modal visible={!!bokning} animationType="slide" presentationStyle="pageSheet" onRequestClose={onStäng}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={rv.container}>
          <View style={rv.headerRad}>
            <Text style={rv.rubrik}>Hur blev det?</Text>
            <TouchableOpacity onPress={onStäng} style={rv.stängBtn} accessibilityLabel="Stäng">
              <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={rv.sub}>{bokning?.tjanst_namn} · {bokning?.datum_formaterat}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setBetyg(n)} accessibilityLabel={`${n} stjärnor`}>
                <Text style={{ fontSize: 36, color: n <= betyg ? '#F59E0B' : '#D1D5DB' }}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={rv.input} multiline placeholder="Kommentar (valfri)" value={kommentar}
            onChangeText={setKommentar} placeholderTextColor="#9CA3AF" />
          <TouchableOpacity style={[rv.btn, sparar && { opacity: 0.6 }]} onPress={spara} disabled={sparar}>
            {sparar ? <ActivityIndicator color="#fff" /> : <Text style={rv.btnText}>Skicka betyg</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BokningKort({ bokning, onBetala, onSpåra, onAvboka, onBetyg }) {
  const färg = STATUS_FÄRG[bokning.status_farg] ?? '#6B7280';
  const ikon = tjänstInfo(bokning.tjanst).ikon;
  const slutförd = bokning.status === 'slutford';
  return (
    <View style={h.kort}>
      <View style={h.kortHeader}>
        <View style={h.ikonBakgrund}><Text style={{ fontSize: 22 }}>{ikon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={h.typ}>{bokning.tjanst_namn}</Text>
          <Text style={h.datum}>{bokning.datum_formaterat} · {bokning.tid}</Text>
        </View>
        <View style={[h.badge, { backgroundColor: färg + '20' }]}>
          <Text style={[h.badgeText, { color: färg }]}>{bokning.status_label}</Text>
        </View>
      </View>

      <Text style={h.detalj}>📍 {bokning.gatuadress}, {bokning.stad}</Text>
      {bokning.stadare?.namn ? <Text style={h.detalj}>🧑‍🔧 {bokning.stadare.namn}</Text> : null}
      <Text style={h.pris}>
        {kr(bokning.belopp_att_betala)}{bokning.rut_avdrag > 0 ? ' efter RUT' : ''}
      </Text>

      <View style={h.knappRad}>
        {bokning.status === 'vantar_betalning' && (
          <TouchableOpacity style={h.primärBtn} onPress={() => onBetala(bokning)}>
            <Text style={h.primärText}>Betala</Text>
          </TouchableOpacity>
        )}
        {SPÅRBARA.has(bokning.status) && (
          <TouchableOpacity style={h.primärBtn} onPress={() => onSpåra(bokning)}>
            <Text style={h.primärText}>📍 Följ städaren</Text>
          </TouchableOpacity>
        )}
        {slutförd && !bokning.betygsatt && (
          <TouchableOpacity style={h.primärBtn} onPress={() => onBetyg(bokning)}>
            <Text style={h.primärText}>★ Betygsätt</Text>
          </TouchableOpacity>
        )}
        {slutförd && bokning.betygsatt ? (
          <Text style={h.betyg}>{'★'.repeat(bokning.betygsatt)}</Text>
        ) : null}
        {bokning.ar_kommande && !SPÅRBARA.has(bokning.status) && (
          <TouchableOpacity style={h.sekundärBtn} onPress={() => onAvboka(bokning)}>
            <Text style={h.sekundärText}>Avboka</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function HistorikScreen({ navigation }) {
  const [data, setData] = useState({ kommande: [], tidigare: [] });
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [fel, setFel] = useState('');
  const [betygBokning, setBetygBokning] = useState(null);

  const hämta = useCallback(async () => {
    try {
      setData(await hämtaMinaBokningar());
      setFel('');
    } catch (e) {
      setFel(felText(e, 'Kunde inte hämta bokningar.'));
    } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { hämta(); }, [hämta]));

  function avboka(bokning) {
    Alert.alert('Avboka städningen?', `${bokning.tjanst_namn}, ${bokning.datum_formaterat} kl ${bokning.tid}`, [
      { text: 'Behåll', style: 'cancel' },
      {
        text: 'Avboka', style: 'destructive', onPress: async () => {
          try { await avbokaBokning(bokning.booking_id); hämta(); } catch (e) { Alert.alert('Kunde inte avboka', felText(e)); }
        },
      },
    ]);
  }

  const sektioner = [
    { titel: 'Kommande', data: data.kommande },
    { titel: 'Tidigare', data: data.tidigare },
  ].filter((s) => s.data.length > 0);

  if (laddar) {
    return <SafeAreaView style={h.safe}><ActivityIndicator size="large" color={TEAL} style={{ flex: 1 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={h.safe} edges={['top']}>
      <BetygModal bokning={betygBokning} onStäng={() => setBetygBokning(null)}
        onSparad={() => { setBetygBokning(null); hämta(); }} />
      <SectionList
        sections={sektioner}
        keyExtractor={(item) => item.booking_id}
        contentContainerStyle={h.lista}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={uppdaterar} tintColor={TEAL}
          onRefresh={() => { setUppdaterar(true); hämta(); }} />}
        ListHeaderComponent={
          <>
            <Text style={h.rubrik}>Mina bokningar</Text>
            {!!fel && <Text style={h.fel}>{fel}</Text>}
          </>
        }
        renderSectionHeader={({ section }) => <Text style={h.sektion}>{section.titel}</Text>}
        ListEmptyComponent={
          <View style={h.tom}>
            <Text style={{ fontSize: 48 }}>🧹</Text>
            <Text style={h.tomText}>Inga bokningar ännu</Text>
            <TouchableOpacity style={[h.primärBtn, { marginTop: 16 }]} onPress={() => navigation.navigate('Boka')}>
              <Text style={h.primärText}>Boka din första städning</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <BokningKort
            bokning={item}
            onBetala={(b) => navigation.navigate('Betalning', { bokning: b })}
            onSpåra={(b) => navigation.navigate('Hem', { screen: 'Tracking', params: { bokningId: b.booking_id } })}
            onAvboka={avboka}
            onBetyg={setBetygBokning}
          />
        )}
      />
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  lista: { paddingHorizontal: 20, paddingBottom: 32 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginTop: 16, marginBottom: 8 },
  sektion: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
  fel: { color: '#DC2626', marginBottom: 8 },
  kort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  kortHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ikonBakgrund: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0FBF7', alignItems: 'center', justifyContent: 'center' },
  typ: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  datum: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detalj: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pris: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginTop: 8 },
  knappRad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 },
  primärBtn: { backgroundColor: TEAL, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  primärText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sekundärBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#E5E7EB' },
  sekundärText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  betyg: { color: '#F59E0B', fontSize: 18 },
  tom: { alignItems: 'center', paddingTop: 60 },
  tomText: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 12 },
});

const rv = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  headerRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rubrik: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  stängBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 14, color: '#6B7280', marginTop: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
  btn: { backgroundColor: TEAL, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
