import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { uppdateraKund } from '../lib/api';

const TEAL = '#1D9E75';

function InställningRad({ ikon, etikett, värde, onTryck, toggle, toggleVärde, onToggle }) {
  return (
    <TouchableOpacity
      style={p.rad}
      onPress={onTryck}
      activeOpacity={toggle ? 1 : 0.7}
      disabled={!!toggle}
    >
      <Text style={p.radIkon}>{ikon}</Text>
      <Text style={p.radEtikett}>{etikett}</Text>
      {toggle
        ? <Switch value={toggleVärde} onValueChange={onToggle} trackColor={{ true: TEAL }} />
        : värde
          ? <Text style={p.radVärde}>{värde}</Text>
          : <Text style={p.radPil}>›</Text>}
    </TouchableOpacity>
  );
}

function RedigeraFältModal({ synlig, fält, etikett, nuvarandeVärde, onSpara, onStäng }) {
  const [värde, setVärde] = useState(nuvarandeVärde ?? '');
  return synlig ? (
    <View style={p.modalOverlay}>
      <View style={p.modal}>
        <Text style={p.modalRubrik}>Ändra {etikett.toLowerCase()}</Text>
        <TextInput
          style={p.modalInput}
          value={värde}
          onChangeText={setVärde}
          autoFocus
          placeholderTextColor="#9CA3AF"
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={p.modalAvbryt} onPress={onStäng}>
            <Text style={{ color: '#6B7280', fontWeight: '600' }}>Avbryt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={p.modalSpara} onPress={() => onSpara(fält, värde)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Spara</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;
}

export default function ProfilScreen() {
  const { kund, loggaUt } = useAuth();
  const [kundData, setKundData] = useState(null);
  const [redigerar, setRedigerar] = useState(null); // { fält, etikett, värde }
  const [notiser, setNotiser] = useState(true);
  const [sparar, setSparar] = useState(false);

  useEffect(() => {
    if (kund) setKundData(kund);
  }, [kund]);

  async function hanteraSpara(fält, värde) {
    if (!kundData?.id) return;
    setSparar(true);
    try {
      const uppdaterad = await uppdateraKund(kundData.id, { [fält]: värde });
      setKundData(prev => ({ ...prev, ...uppdaterad, [fält]: värde }));
      setRedigerar(null);
    } catch {
      Alert.alert('Fel', 'Kunde inte spara ändringen');
    } finally {
      setSparar(false);
    }
  }

  function hanteraLoggaUt() {
    Alert.alert(
      'Logga ut',
      'Är du säker på att du vill logga ut?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Logga ut', style: 'destructive', onPress: loggaUt },
      ]
    );
  }

  const visningsNamn = kundData?.fornamn
    ? `${kundData.fornamn} ${kundData.efternamn ?? ''}`.trim()
    : kundData?.email ?? 'Kund';
  const initialer = visningsNamn.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={p.safe}>
      <RedigeraFältModal
        synlig={!!redigerar}
        fält={redigerar?.fält}
        etikett={redigerar?.etikett ?? ''}
        nuvarandeVärde={redigerar?.värde}
        onSpara={hanteraSpara}
        onStäng={() => setRedigerar(null)}
      />

      <ScrollView contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={p.profilHuvud}>
          <View style={p.avatar}>
            <Text style={p.avatarText}>{initialer || '?'}</Text>
          </View>
          <Text style={p.namn}>{visningsNamn}</Text>
          <Text style={p.email}>{kundData?.email ?? ''}</Text>
        </View>

        {/* Personuppgifter */}
        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Personuppgifter</Text>
          <InställningRad
            ikon="👤" etikett="Förnamn" värde={kundData?.fornamn ?? '—'}
            onTryck={() => setRedigerar({ fält: 'fornamn', etikett: 'Förnamn', värde: kundData?.fornamn })}
          />
          <InställningRad
            ikon="👤" etikett="Efternamn" värde={kundData?.efternamn ?? '—'}
            onTryck={() => setRedigerar({ fält: 'efternamn', etikett: 'Efternamn', värde: kundData?.efternamn })}
          />
          <InställningRad
            ikon="📱" etikett="Telefon" värde={kundData?.telefon ?? '—'}
            onTryck={() => setRedigerar({ fält: 'telefon', etikett: 'Telefon', värde: kundData?.telefon })}
          />
          <InställningRad
            ikon="✉️" etikett="E-post" värde={kundData?.email ?? '—'}
            onTryck={() => setRedigerar({ fält: 'email', etikett: 'E-post', värde: kundData?.email })}
          />
        </View>

        {/* Adresser */}
        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Sparade adresser</Text>
          <InställningRad
            ikon="🏠" etikett="Hemadress"
            värde={kundData?.adress ?? 'Ej angiven'}
            onTryck={() => setRedigerar({ fält: 'adress', etikett: 'Hemadress', värde: kundData?.adress })}
          />
          <InställningRad
            ikon="🏢" etikett="Arbetsadress"
            värde={kundData?.arbetsadress ?? 'Ej angiven'}
            onTryck={() => Alert.alert('Arbetsadress', 'Lägg till arbetsadress i nästa version')}
          />
        </View>

        {/* Betalning */}
        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Betalning</Text>
          <InställningRad
            ikon="💳" etikett="Betalningsmetoder"
            onTryck={() => Alert.alert('Betalningsmetoder', 'Hanteras via Stripe Payment Sheet')}
          />
          <InställningRad
            ikon="🧾" etikett="RUT-avdrag"
            värde="Aktiverat"
            onTryck={() => Alert.alert('RUT-avdrag', '50% avdrag tillämpas automatiskt vid bokning')}
          />
        </View>

        {/* Inställningar */}
        <View style={p.sektion}>
          <Text style={p.sektionRubrik}>Inställningar</Text>
          <InställningRad
            ikon="🔔" etikett="Aviseringar"
            toggle toggleVärde={notiser} onToggle={setNotiser}
          />
          <InställningRad
            ikon="🌍" etikett="Språk" värde="Svenska"
            onTryck={() => Alert.alert('Språk', 'sv / no / fi / da stöds i appen')}
          />
          <InställningRad
            ikon="🔒" etikett="Integritetspolicy"
            onTryck={() => Alert.alert('Integritetspolicy', 'GDPR-kompatibel — se serviceos.app/integritetspolicy')}
          />
        </View>

        {/* Logga ut */}
        <TouchableOpacity style={p.loggaUtBtn} onPress={hanteraLoggaUt} activeOpacity={0.8}>
          <Text style={p.loggaUtText}>Logga ut</Text>
        </TouchableOpacity>

        <Text style={p.version}>serviceOS v1.0.0 · © 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  profilHuvud: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, elevation: 6,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  namn: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  sektion: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2,
  },
  sektionRubrik: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  rad: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  radIkon: { fontSize: 18, marginRight: 14, width: 24, textAlign: 'center' },
  radEtikett: { flex: 1, fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  radVärde: { fontSize: 14, color: '#6B7280' },
  radPil: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },
  loggaUtBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: '#FECACA',
  },
  loggaUtText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, elevation: 10,
  },
  modalRubrik: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 16, color: '#1A1A2E', marginBottom: 16,
  },
  modalAvbryt: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  modalSpara: {
    flex: 1, backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
});
