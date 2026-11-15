import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '../lib/stripe';
import { Alert } from '../lib/alert';
import { felText, hämtaConfig, skapaPaymentIntent } from '../lib/api';
import { TEAL, kr } from '../lib/tjanster';

function Rad({ etikett, värde, framhäv, färg }) {
  return (
    <View style={[b.sumRad, framhäv && b.sumTotal]}>
      <Text style={[b.sumEtikett, framhäv && { fontWeight: '700', fontSize: 16, color: '#1A1A2E' }, färg && { color: färg }]}>{etikett}</Text>
      <Text style={[b.sumVärde, framhäv && { color: TEAL, fontWeight: '800', fontSize: 20 }, färg && { color: färg }]}>{värde}</Text>
    </View>
  );
}

/**
 * Tar emot `bokning` = svaret från POST /api/bokningar/skapa:
 * { booking_id, pris, rut_avdrag, belopp_att_betala, tjanst_namn, storlek_namn, datum_formaterat, tid }
 * Alla belopp kommer från backend — appen räknar inte om något här.
 */
export default function BetalningScreen({ navigation, route }) {
  const bokning = route?.params?.bokning;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [läge, setLäge] = useState('laddar'); // laddar | redo | ej_aktiverad | fel
  const [felmeddelande, setFelmeddelande] = useState('');
  const [betalar, setBetalar] = useState(false);
  const [belopp, setBelopp] = useState(bokning?.belopp_att_betala ?? 0);

  useEffect(() => {
    if (!bokning?.booking_id) return;
    let aktiv = true;
    (async () => {
      const { stripeKey } = await hämtaConfig();
      if (!stripeKey) { if (aktiv) setLäge('ej_aktiverad'); return; }
      try {
        const pi = await skapaPaymentIntent(bokning.booking_id);
        if (!aktiv) return;
        setBelopp(pi.belopp_att_betala);
        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: pi.client_secret,
          merchantDisplayName: 'serviceOS',
          style: 'alwaysLight',
          defaultBillingDetails: { address: { country: 'SE' } },
          allowsDelayedPaymentMethods: false,
          returnURL: 'serviceos-kund://betalning',
        });
        if (!aktiv) return;
        if (error) { setFelmeddelande(error.message); setLäge('fel'); } else setLäge('redo');
      } catch (e) {
        if (!aktiv) return;
        setFelmeddelande(felText(e, 'Kunde inte starta betalningen.'));
        setLäge('fel');
      }
    })();
    return () => { aktiv = false; };
  }, [bokning?.booking_id]);

  async function betala() {
    setBetalar(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert('Betalningen gick inte igenom', error.message);
        return;
      }
      // Stripe-webhooken markerar bokningen som betald i backend.
      Alert.alert('Tack! 🎉', 'Betalningen är klar. Vi matchar nu en städare åt dig.', [
        { text: 'Se min bokning', onPress: gåTillBokningar },
      ]);
    } finally {
      setBetalar(false);
    }
  }

  function gåTillBokningar() {
    navigation.navigate('BottomTabs', { screen: 'Historik' });
  }

  if (!bokning) {
    return (
      <SafeAreaView style={b.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#6B7280' }}>Ingen bokningsinformation</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={b.safe}>
      <ScrollView contentContainerStyle={b.scroll} showsVerticalScrollIndicator={false}>
        <View style={b.headerRad}>
          <Text style={b.rubrik}>Betalning</Text>
          <TouchableOpacity onPress={gåTillBokningar} style={b.stängBtn} accessibilityLabel="Stäng">
            <Text style={b.stängText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={b.bekräftad}>
          <Text style={b.bekräftadText}>✓ Bokningen är registrerad</Text>
        </View>

        <View style={b.kort}>
          <Text style={b.kortRubrik}>Din bokning</Text>
          <Text style={b.infoTyp}>{bokning.tjanst_namn} · {bokning.storlek_namn}</Text>
          <Text style={b.infoTid}>{bokning.datum_formaterat} kl {bokning.tid}</Text>
          {!!bokning.gatuadress && <Text style={b.infoTid}>📍 {bokning.gatuadress}, {bokning.stad}</Text>}
        </View>

        <View style={b.kort}>
          <Text style={b.kortRubrik}>Pris</Text>
          <Rad etikett="Pris inkl. moms" värde={kr(bokning.pris)} />
          {bokning.rut_avdrag > 0 && <Rad etikett="RUT-avdrag (50 %)" värde={`–${kr(bokning.rut_avdrag)}`} färg={TEAL} />}
          <Rad etikett="Att betala" värde={kr(belopp)} framhäv />
        </View>

        <View style={b.kort}>
          {läge === 'laddar' && <ActivityIndicator color={TEAL} style={{ paddingVertical: 12 }} />}

          {läge === 'redo' && (
            <TouchableOpacity style={[b.betalaBtn, betalar && { opacity: 0.6 }]} onPress={betala} disabled={betalar} activeOpacity={0.85}>
              {betalar ? <ActivityIndicator color="#fff" /> : <Text style={b.betalaText}>💳 Betala {kr(belopp)}</Text>}
            </TouchableOpacity>
          )}

          {läge === 'ej_aktiverad' && (
            <Text style={b.info}>
              Kortbetalning i appen är inte aktiverad än. Bokningen är sparad — du får betalningsinstruktioner via e-post.
            </Text>
          )}

          {läge === 'fel' && (
            <Text style={[b.info, { color: '#B91C1C' }]}>
              {felmeddelande || 'Betalningen kunde inte startas.'} Bokningen är sparad och du kan betala senare.
            </Text>
          )}

          {läge !== 'redo' && läge !== 'laddar' && (
            <TouchableOpacity style={b.sekundärBtn} onPress={gåTillBokningar}>
              <Text style={b.sekundärText}>Till mina bokningar</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={b.säkerhet}>🔒 Betalningen hanteras av Stripe. Kortuppgifter sparas aldrig hos oss.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const b = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  headerRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  stängBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stängText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  bekräftad: { backgroundColor: TEAL + '15', borderRadius: 12, padding: 12, marginBottom: 16 },
  bekräftadText: { color: '#065F46', fontWeight: '700', fontSize: 14 },
  kort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  kortRubrik: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoTyp: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  infoTid: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  sumRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumTotal: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 4, marginBottom: 0 },
  sumEtikett: { fontSize: 14, color: '#6B7280' },
  sumVärde: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  betalaBtn: { backgroundColor: '#1A1A2E', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  betalaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  info: { fontSize: 14, color: '#374151', lineHeight: 20 },
  sekundärBtn: { marginTop: 14, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', paddingVertical: 13, alignItems: 'center' },
  sekundärText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  säkerhet: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },
});
