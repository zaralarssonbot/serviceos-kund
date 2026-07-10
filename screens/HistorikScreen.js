import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';
import api, { hämtaMinaBokningar } from '../lib/api';

const TEAL = '#1D9E75';

const STATUS_ETIKETT = {
  OBOKAD: 'Obokad', TILLDELAD: 'Tilldelad', PAGAENDE: 'Pågående',
  KLAR: 'Klar', FAKTURERAD: 'Fakturerad', BETALD: 'Betald',
};
const STATUS_FÄRG = {
  OBOKAD: '#6B7280', TILLDELAD: '#3B82F6', PAGAENDE: '#F59E0B',
  KLAR: '#10B981', FAKTURERAD: '#8B5CF6', BETALD: '#10B981',
};
const TYP_ETIKETT = { STADNING: 'Hemstädning', OMSORG: 'Kontorsstädning', LOGISTIK: 'Flyttstädning' };

function StarVäljare({ värde, onVälj }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onVälj(n)}>
          <Text style={{ fontSize: 32 }}>{n <= värde ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewModal({ synlig, bokning, onStäng, onSpara }) {
  const [betyg, setBetyg] = useState(5);
  const [kommentar, setKommentar] = useState('');
  const [sparar, setSparar] = useState(false);

  async function hanteraSave() {
    setSparar(true);
    try {
      await onSpara(bokning.id, betyg, kommentar);
      onStäng();
    } catch {
      Alert.alert('Fel', 'Kunde inte spara recension');
    } finally {
      setSparar(false);
    }
  }

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet" onRequestClose={onStäng}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={rv.container}>
          <View style={rv.headerRad}>
            <Text style={rv.rubrik}>Lämna recension</Text>
            <TouchableOpacity onPress={onStäng} style={rv.stängBtn}>
              <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={rv.sub}>
            {TYP_ETIKETT[bokning?.typ] ?? bokning?.typ}
            {bokning?.startdatum ? ` · ${new Date(bokning.startdatum).toLocaleDateString('sv-SE')}` : ''}
          </Text>

          <Text style={rv.etikett}>Hur var städningen?</Text>
          <StarVäljare värde={betyg} onVälj={setBetyg} />

          <Text style={rv.etikett}>Kommentar (valfri)</Text>
          <TextInput
            style={rv.input}
            multiline
            numberOfLines={4}
            placeholder="Berätta om din upplevelse…"
            value={kommentar}
            onChangeText={setKommentar}
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={[rv.btn, sparar && { opacity: 0.6 }]}
            onPress={hanteraSave}
            disabled={sparar}
          >
            {sparar
              ? <ActivityIndicator color="#fff" />
              : <Text style={rv.btnText}>Skicka recension</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BokningKort({ bokning, onReview, onTracking }) {
  const klickbar = bokning.status === 'TILLDELAD' || bokning.status === 'PAGAENDE';
  const kanReviewas = bokning.status === 'KLAR' || bokning.status === 'BETALD';

  return (
    <View style={h.kort}>
      <View style={h.kortHeader}>
        <View style={h.ikonBakgrund}>
          <Text style={{ fontSize: 22 }}>
            {bokning.typ === 'STADNING' ? '🏠' : bokning.typ === 'OMSORG' ? '🏢' : '📦'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={h.typ}>{TYP_ETIKETT[bokning.typ] ?? bokning.typ}</Text>
          <Text style={h.datum}>
            {bokning.startdatum
              ? new Date(bokning.startdatum).toLocaleDateString('sv-SE', {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                })
              : '—'}
          </Text>
        </View>
        <View style={[h.badge, { backgroundColor: (STATUS_FÄRG[bokning.status] ?? '#6B7280') + '20' }]}>
          <Text style={[h.badgeText, { color: STATUS_FÄRG[bokning.status] ?? '#6B7280' }]}>
            {STATUS_ETIKETT[bokning.status] ?? bokning.status}
          </Text>
        </View>
      </View>

      {bokning.pris_exkl_moms && (
        <Text style={h.pris}>
          {Number(bokning.pris_exkl_moms).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr exkl. moms
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {klickbar && (
          <TouchableOpacity style={h.spårBtn} onPress={() => onTracking(bokning)}>
            <Text style={h.spårBtnText}>📍 Spåra städaren</Text>
          </TouchableOpacity>
        )}
        {kanReviewas && (
          <TouchableOpacity style={h.reviewBtn} onPress={() => onReview(bokning)}>
            <Text style={h.reviewBtnText}>⭐ Lämna recension</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function HistorikScreen({ navigation }) {
  const { kund } = useAuth();
  const [bokningar, setBokningar] = useState([]);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);
  const [reviewBokning, setReviewBokning] = useState(null);

  const hämta = useCallback(async () => {
    if (!kund?.id) return;
    try {
      const data = await hämtaMinaBokningar(kund.id);
      setBokningar(data);
    } catch { /* tyst */ }
    finally { setLaddar(false); setUppdaterar(false); }
  }, [kund?.id]);

  useEffect(() => { hämta(); }, [hämta]);

  async function sparaReview(jobbId, betyg, kommentar) {
    await api.post('/api/reviews', { jobb_id: jobbId, betyg, kommentar });
    Alert.alert('Tack!', 'Din recension har sparats.');
    await hämta();
  }

  if (laddar) {
    return (
      <SafeAreaView style={h.safe}>
        <ActivityIndicator size="large" color={TEAL} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={h.safe}>
      <ReviewModal
        synlig={!!reviewBokning}
        bokning={reviewBokning}
        onStäng={() => setReviewBokning(null)}
        onSpara={sparaReview}
      />

      <FlatList
        data={bokningar}
        keyExtractor={item => item.id?.toString()}
        contentContainerStyle={h.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={uppdaterar}
            onRefresh={() => { setUppdaterar(true); hämta(); }}
            tintColor={TEAL}
          />
        }
        ListHeaderComponent={
          <Text style={h.rubrik}>Mina bokningar</Text>
        }
        ListEmptyComponent={
          <View style={h.tom}>
            <Text style={{ fontSize: 48 }}>🧹</Text>
            <Text style={h.tomText}>Inga bokningar ännu</Text>
            <Text style={h.tomSub}>Boka din första städning via fliken Boka</Text>
          </View>
        }
        renderItem={({ item }) => (
          <BokningKort
            bokning={item}
            onReview={setReviewBokning}
            onTracking={(b) => navigation.navigate('Hem', { screen: 'Tracking', params: { bokningId: b.id } })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  lista: { paddingHorizontal: 20, paddingBottom: 32 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginTop: 16, marginBottom: 20 },
  kort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  kortHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ikonBakgrund: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F0FBF7', alignItems: 'center', justifyContent: 'center',
  },
  typ: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  datum: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  pris: { fontSize: 14, color: '#6B7280', marginTop: 10 },
  spårBtn: {
    flex: 1, backgroundColor: TEAL + '15', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: TEAL + '30',
  },
  spårBtnText: { fontSize: 13, fontWeight: '600', color: TEAL },
  reviewBtn: {
    flex: 1, backgroundColor: '#FFF7ED', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA',
  },
  reviewBtnText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  tom: { alignItems: 'center', paddingTop: 80, gap: 12 },
  tomText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  tomSub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

const rv = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  headerRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rubrik: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  stängBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  etikett: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 4 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A2E',
    minHeight: 100, textAlignVertical: 'top', marginBottom: 20,
  },
  btn: {
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
