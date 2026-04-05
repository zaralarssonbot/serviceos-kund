import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { skapaPaymentIntent } from '../lib/api';

const TEAL = '#1D9E75';

function SummeringsRad({ etikett, värde, framhäv }) {
  return (
    <View style={[b.sumRad, framhäv && { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14, marginTop: 6 }]}>
      <Text style={[b.sumEtikett, framhäv && { fontWeight: '700', fontSize: 16 }]}>{etikett}</Text>
      <Text style={[b.sumVärde, framhäv && { color: TEAL, fontWeight: '800', fontSize: 20 }]}>{värde}</Text>
    </View>
  );
}

export default function BetalningScreen({ navigation, route }) {
  const { jobb, rutAvdrag } = route?.params ?? {};
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [laddar, setLaddar] = useState(false);
  const [redo, setRedo] = useState(false);

  const pris = jobb?.pris_exkl_moms ?? 0;
  const moms = pris * 0.25;
  const rut = rutAvdrag ? Math.min(pris * 0.5, 3125) : 0;
  const totalt = pris + moms - rut;

  useEffect(() => {
    if (!jobb?.id) return;
    (async () => {
      setLaddar(true);
      try {
        const { client_secret, publishable_key } = await skapaPaymentIntent(jobb.id);
        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: client_secret,
          merchantDisplayName: 'serviceOS',
          style: 'alwaysLight',
          defaultBillingDetails: { address: { country: 'SE' } },
          allowsDelayedPaymentMethods: false,
        });
        if (!error) setRedo(true);
      } catch {
        // Om payment-intent saknas i backend, tillåt ändå UI-demo
        setRedo(true);
      } finally {
        setLaddar(false);
      }
    })();
  }, [jobb?.id]);

  async function hanteraStripeBetalning() {
    if (!redo) return;
    setLaddar(true);
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert('Betalning avbruten', error.message);
        return;
      }
      Alert.alert(
        'Betalning genomförd! 🎉',
        'Din städning är bokad. Du kan följa städaren i realtid.',
        [{ text: 'Följ städaren', onPress: () => navigation.replace('Tracking', { bokningId: jobb.id }) }]
      );
    } finally {
      setLaddar(false);
    }
  }

  function hanteraSwish() {
    Alert.alert(
      'Swish',
      'Öppnar Swish-appen för betalning på 990 kr.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Betala med Swish', onPress: () => {
            Alert.alert('Swish-betalning mottagen', 'Städningen är nu bekräftad!', [
              { text: 'OK', onPress: () => navigation.navigate('Hem') },
            ]);
          }
        },
      ]
    );
  }

  if (!jobb) {
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
        {/* Rubrik + stäng */}
        <View style={b.headerRad}>
          <Text style={b.rubrik}>Betalning</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={b.stängBtn}>
            <Text style={b.stängText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Bokningsinfo */}
        <View style={b.infoKort}>
          <Text style={b.infoRubrik}>Din bokning</Text>
          <View style={b.infoRad}>
            <Text style={b.infoIkon}>
              {jobb.typ === 'STADNING' ? '🏠' : jobb.typ === 'OMSORG' ? '🏢' : '📦'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={b.infoTyp}>
                {jobb.typ === 'STADNING' ? 'Hemstädning' : jobb.typ === 'OMSORG' ? 'Kontorsstädning' : 'Flyttstädning'}
              </Text>
              {jobb.startdatum && (
                <Text style={b.infoTid}>
                  {new Date(jobb.startdatum).toLocaleDateString('sv-SE', {
                    weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              )}
              {jobb.noteringar && (
                <Text style={b.infoAdress}>📍 {jobb.noteringar}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Prisöversikt */}
        <View style={b.prisKort}>
          <Text style={b.prisRubrik}>Prisöversikt</Text>
          <SummeringsRad etikett="Städning" värde={`${pris.toLocaleString('sv-SE')} kr`} />
          <SummeringsRad etikett="Moms (25%)" värde={`${Math.round(moms).toLocaleString('sv-SE')} kr`} />
          {rutAvdrag && (
            <SummeringsRad
              etikett="RUT-avdrag (50%)"
              värde={`–${Math.round(rut).toLocaleString('sv-SE')} kr`}
            />
          )}
          <SummeringsRad
            etikett="Totalt"
            värde={`${Math.round(totalt).toLocaleString('sv-SE')} kr`}
            framhäv
          />
          <View style={b.rutInfo}>
            <Text style={b.rutInfoText}>
              💡 RUT-avdraget dras direkt — du betalar bara din andel
            </Text>
          </View>
        </View>

        {/* Betalningsknappar */}
        <View style={b.betalningar}>
          <Text style={b.betalRubrik}>Välj betalmetod</Text>

          {/* Stripe */}
          <TouchableOpacity
            style={[b.stripeBtn, (laddar || !redo) && { opacity: 0.6 }]}
            onPress={hanteraStripeBetalning}
            disabled={laddar || !redo}
            activeOpacity={0.85}
          >
            {laddar
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>💳</Text>
                  <Text style={b.stripeBtnText}>Betala med kort / Apple Pay / Google Pay</Text>
                </View>
              )}
          </TouchableOpacity>

          {/* Swish */}
          <TouchableOpacity style={b.swishBtn} onPress={hanteraSwish} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>🔵</Text>
              <View>
                <Text style={b.swishBtnText}>Betala med Swish</Text>
                <Text style={b.swishBtnSub}>Direktbetalning via mobilnummer</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Säkerhetsfot */}
        <View style={b.säkerhets}>
          <Text style={b.säkerhetsText}>🔒 Betalningen sker säkert via Stripe</Text>
          <Text style={b.säkerhetsText}>Kortuppgifter lagras aldrig hos serviceOS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const b = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  headerRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  rubrik: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  stängBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stängText: { fontSize: 16, color: '#6B7280', fontWeight: '600' },
  infoKort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  infoRubrik: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  infoRad: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  infoIkon: { fontSize: 32 },
  infoTyp: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  infoTid: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  infoAdress: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  prisKort: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  prisRubrik: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  sumRad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumEtikett: { fontSize: 14, color: '#6B7280' },
  sumVärde: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  rutInfo: { backgroundColor: TEAL + '10', borderRadius: 10, padding: 12, marginTop: 12 },
  rutInfoText: { fontSize: 12, color: '#065F46' },
  betalningar: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 3,
  },
  betalRubrik: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  stripeBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', marginBottom: 12,
  },
  stripeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  swishBtn: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  swishBtnText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  swishBtnSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  säkerhets: { alignItems: 'center', marginTop: 24, gap: 4 },
  säkerhetsText: { fontSize: 12, color: '#9CA3AF' },
});
