import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { hämtaMinaBokningar } from '../lib/api';
import { STATUS_FÄRG, TEAL, TJÄNSTER, kr, tjänstInfo } from '../lib/tjanster';

const SPÅRBARA = new Set(['tilldelad', 'pa_vag', 'framme', 'pagar']);

function NästaBokning({ bokning, onTryck }) {
  const färg = STATUS_FÄRG[bokning.status_farg] ?? '#6B7280';
  return (
    <TouchableOpacity style={s.nästa} onPress={onTryck} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={s.nästaIkon}><Text style={{ fontSize: 22 }}>{tjänstInfo(bokning.tjanst).ikon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.nästaEtikett}>NÄSTA STÄDNING</Text>
          <Text style={s.nästaTyp}>{bokning.tjanst_namn}</Text>
          <Text style={s.nästaDatum}>{bokning.datum_formaterat} kl {bokning.tid}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: färg + '20' }]}>
          <Text style={[s.badgeText, { color: färg }]}>{bokning.status_label}</Text>
        </View>
      </View>
      {SPÅRBARA.has(bokning.status) && <Text style={s.nästaLänk}>📍 Följ städaren i realtid ›</Text>}
      {bokning.status === 'vantar_betalning' && (
        <Text style={s.nästaLänk}>Betala {kr(bokning.belopp_att_betala)} ›</Text>
      )}
    </TouchableOpacity>
  );
}

export default function HemScreen({ navigation }) {
  const { kund } = useAuth();
  const [nästa, setNästa] = useState(null);
  const [laddar, setLaddar] = useState(true);
  const [uppdaterar, setUppdaterar] = useState(false);

  const hämta = useCallback(async () => {
    try {
      const { kommande } = await hämtaMinaBokningar();
      setNästa(kommande[0] ?? null);
    } catch { /* visa bara utan nästa bokning */ } finally {
      setLaddar(false);
      setUppdaterar(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { hämta(); }, [hämta]));

  function tryckNästa() {
    if (SPÅRBARA.has(nästa.status)) navigation.navigate('Tracking', { bokningId: nästa.booking_id });
    else if (nästa.status === 'vantar_betalning') navigation.navigate('Betalning', { bokning: nästa });
    else navigation.navigate('Historik');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={uppdaterar} tintColor={TEAL}
          onRefresh={() => { setUppdaterar(true); hämta(); }} />}>
        <View style={s.hälsning}>
          <Text style={s.hälsningText}>Hej{kund?.fornamn ? ` ${kund.fornamn}` : ''}! 👋</Text>
          <Text style={s.tagline}>Vad vill du ha hjälp med?</Text>
        </View>

        {laddar ? <ActivityIndicator color={TEAL} style={{ marginBottom: 20 }} />
          : nästa && <NästaBokning bokning={nästa} onTryck={tryckNästa} />}

        <View style={s.banner}>
          <Text style={s.bannerEmoji}>💚</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerRubrik}>Halva priset med RUT</Text>
            <Text style={s.bannerSub}>Vi drar avdraget direkt på hem-, flytt- och fönsterstädning.</Text>
          </View>
        </View>

        <Text style={s.sektionRubrik}>Tjänster</Text>
        <View style={s.tjänsterRutnät}>
          {TJÄNSTER.map((t) => (
            <TouchableOpacity key={t.id} activeOpacity={0.7}
              style={[s.tjänstKort, { backgroundColor: t.färg, borderColor: t.kantfärg }]}
              onPress={() => navigation.navigate('Boka', { tjanst: t.id })}>
              <Text style={s.tjänstIkon}>{t.ikon}</Text>
              <Text style={s.tjänstText}>{t.etikett}</Text>
              {t.rut && <Text style={s.tjänstRut}>RUT</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.bokaBtn} onPress={() => navigation.navigate('Boka')} activeOpacity={0.85}>
          <Text style={s.bokaBtnText}>Boka städning</Text>
          <Text style={{ fontSize: 18, color: '#fff' }}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  hälsning: { marginTop: 16, marginBottom: 20 },
  hälsningText: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  tagline: { fontSize: 15, color: '#6B7280', marginTop: 2 },
  nästa: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 20,
    borderWidth: 2, borderColor: TEAL + '40',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  nästaIkon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0FBF7', alignItems: 'center', justifyContent: 'center' },
  nästaEtikett: { fontSize: 11, fontWeight: '700', color: TEAL, letterSpacing: 0.5 },
  nästaTyp: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginTop: 2 },
  nästaDatum: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  nästaLänk: { color: TEAL, fontWeight: '700', marginTop: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  banner: {
    backgroundColor: TEAL + '15', borderRadius: 16, padding: 16, flexDirection: 'row',
    alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: TEAL + '30',
  },
  bannerEmoji: { fontSize: 26, marginRight: 12 },
  bannerRubrik: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  bannerSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  sektionRubrik: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  tjänsterRutnät: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tjänstKort: { width: '48%', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2 },
  tjänstIkon: { fontSize: 30, marginBottom: 6 },
  tjänstText: { fontSize: 14, fontWeight: '700', color: '#374151', textAlign: 'center' },
  tjänstRut: { fontSize: 10, fontWeight: '800', color: TEAL, marginTop: 4, letterSpacing: 0.5 },
  bokaBtn: {
    backgroundColor: TEAL, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  bokaBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
