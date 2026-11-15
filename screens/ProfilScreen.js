import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
  Linking, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../lib/alert';
import { BASE_URL, felText } from '../lib/api';
import { TEAL } from '../lib/tjanster';

function Rad({ ikon, etikett, värde, onTryck }) {
  return (
    <TouchableOpacity style={p.rad} onPress={onTryck} disabled={!onTryck} activeOpacity={0.7}>
      <Text style={p.radIkon}>{ikon}</Text>
      <Text style={p.radEtikett}>{etikett}</Text>
      <Text style={p.radVärde} numberOfLines={1}>{värde}</Text>
      {onTryck && <Text style={p.radPil}>›</Text>}
    </TouchableOpacity>
  );
}

const FÄLT = {
  namn: { rubrik: 'Namn', fält: [['fornamn', 'Förnamn'], ['efternamn', 'Efternamn']] },
  email: { rubrik: 'E-post', fält: [['email', 'E-post']] },
  adress: { rubrik: 'Hemadress', fält: [['gatuadress', 'Gatuadress'], ['postnummer', 'Postnummer'], ['stad', 'Ort']] },
};

function RedigeraModal({ typ, kund, onStäng, onSpara }) {
  const def = typ ? FÄLT[typ] : null;
  const [värden, setVärden] = useState(() =>
    Object.fromEntries((def?.fält ?? []).map(([k]) => [k, kund?.[k] ?? '']))
  );
  const [sparar, setSparar] = useState(false);
  if (!def) return null;

  async function spara() {
    setSparar(true);
    try {
      await onSpara(Object.fromEntries(Object.entries(värden).map(([k, v]) => [k, v.trim()])));
      onStäng();
    } catch (e) {
      Alert.alert('Kunde inte spara', felText(e));
    } finally {
      setSparar(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onStäng}>
      <KeyboardAvoidingView style={p.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={p.modal}>
          <Text style={p.modalRubrik}>Ändra {def.rubrik.toLowerCase()}</Text>
          {def.fält.map(([k, etikett], i) => (
            <TextInput key={k} style={p.modalInput} placeholder={etikett} value={värden[k]}
              autoFocus={i === 0} placeholderTextColor="#9CA3AF"
              keyboardType={k === 'email' ? 'email-address' : k === 'postnummer' ? 'number-pad' : 'default'}
              autoCapitalize={k === 'email' ? 'none' : 'words'}
              onChangeText={(v) => setVärden((x) => ({ ...x, [k]: v }))} />
          ))}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity style={p.modalAvbryt} onPress={onStäng}>
              <Text style={{ color: '#6B7280', fontWeight: '600' }}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={p.modalSpara} onPress={spara} disabled={sparar}>
              {sparar ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Spara</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfilScreen() {
  const { kund, uppdatera, loggaUt } = useAuth();
  const [redigerar, setRedigerar] = useState(null);

  const namn = [kund?.fornamn, kund?.efternamn].filter(Boolean).join(' ') || 'Kund';
  const initialer = namn.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const adress = kund?.gatuadress ? `${kund.gatuadress}, ${kund.stad}` : 'Ej angiven';

  function hanteraLoggaUt() {
    Alert.alert('Logga ut', 'Vill du logga ut?', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Logga ut', style: 'destructive', onPress: loggaUt },
    ]);
  }

  return (
    <SafeAreaView style={p.safe} edges={['top']}>
      {redigerar && (
        <RedigeraModal typ={redigerar} kund={kund} onStäng={() => setRedigerar(null)} onSpara={uppdatera} />
      )}
      <ScrollView contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false}>
        <View style={p.profilHuvud}>
          <View style={p.avatar}><Text style={p.avatarText}>{initialer || '?'}</Text></View>
          <Text style={p.namn}>{namn}</Text>
          <Text style={p.email}>{kund?.telefon}</Text>
        </View>

        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Uppgifter</Text>
          <Rad ikon="👤" etikett="Namn" värde={namn} onTryck={() => setRedigerar('namn')} />
          <Rad ikon="✉️" etikett="E-post" värde={kund?.email || 'Ej angiven'} onTryck={() => setRedigerar('email')} />
          <Rad ikon="🏠" etikett="Adress" värde={adress} onTryck={() => setRedigerar('adress')} />
          <Rad ikon="📱" etikett="Mobil" värde={kund?.telefon ?? '—'} />
        </View>

        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>RUT-avdrag</Text>
          <Rad ikon="🧾" etikett="Personnummer"
            värde={kund?.har_personnummer ? 'Sparat ✓' : 'Anges vid bokning'} />
        </View>

        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Övrigt</Text>
          <Rad ikon="🔒" etikett="Integritetspolicy" värde=""
            onTryck={() => Linking.openURL(`${BASE_URL}/integritetspolicy/`)} />
        </View>

        <TouchableOpacity style={p.loggaUtBtn} onPress={hanteraLoggaUt} activeOpacity={0.8}>
          <Text style={p.loggaUtText}>Logga ut</Text>
        </TouchableOpacity>
        <Text style={p.version}>serviceOS · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  profilHuvud: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  namn: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  sektion: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2,
  },
  sektionRubrik: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  rad: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  radIkon: { fontSize: 18, marginRight: 14, width: 24, textAlign: 'center' },
  radEtikett: { fontSize: 15, color: '#1A1A2E', fontWeight: '500', marginRight: 12 },
  radVärde: { flex: 1, fontSize: 14, color: '#6B7280', textAlign: 'right' },
  radPil: { fontSize: 20, color: '#D1D5DB', marginLeft: 8 },
  loggaUtBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#FECACA',
  },
  loggaUtText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '88%' },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 16, color: '#1A1A2E', marginBottom: 12,
  },
  modalAvbryt: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSpara: { flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
