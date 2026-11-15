import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, felText, godkännVillkor, skickaKod, uppdateraProfil } from '../lib/api';
import { TEAL } from '../lib/tjanster';

// Steg: 'telefon' → 'kod' → ('namn' för nya kunder) → inne i appen
export default function LoginScreen() {
  const { loggaInMedKod, slutförInloggning } = useAuth();
  const [steg, setSteg] = useState('telefon');
  const [telefon, setTelefon] = useState('');
  const [kod, setKod] = useState('');
  const [maskerat, setMaskerat] = useState('');
  const [devKod, setDevKod] = useState(null);
  const [profil, setProfil] = useState(null);
  const [fornamn, setFornamn] = useState('');
  const [efternamn, setEfternamn] = useState('');
  const [email, setEmail] = useState('');
  const [villkor, setVillkor] = useState(false);
  const [fel, setFel] = useState('');
  const [laddar, setLaddar] = useState(false);
  const kodRef = useRef(null);

  async function skicka() {
    const siffror = telefon.replace(/[^0-9]/g, '');
    if (siffror.length < 8) { setFel('Ange ett giltigt mobilnummer.'); return; }
    setFel(''); setLaddar(true);
    try {
      const r = await skickaKod(telefon.trim());
      setMaskerat(r.maskerat_nummer);
      setDevKod(r.dev_kod ?? null);
      setKod('');
      setSteg('kod');
      setTimeout(() => kodRef.current?.focus(), 300);
    } catch (e) {
      setFel(felText(e, 'Kunde inte skicka koden.'));
    } finally {
      setLaddar(false);
    }
  }

  async function verifiera(värde = kod) {
    if (värde.length !== 4) return;
    setFel(''); setLaddar(true);
    try {
      const { svar, profil: p } = await loggaInMedKod(telefon.trim(), värde);
      if (svar.ny_kund || !p.fornamn || !p.villkor_godkanda) {
        setProfil(p);
        setFornamn(p.fornamn); setEfternamn(p.efternamn); setEmail(p.email);
        setSteg('namn');
      } else {
        await slutförInloggning(p);
      }
    } catch (e) {
      setFel(felText(e, 'Fel kod. Försök igen.'));
      setKod('');
    } finally {
      setLaddar(false);
    }
  }

  async function sparaNamn() {
    if (!fornamn.trim() || !efternamn.trim()) { setFel('Fyll i för- och efternamn.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setFel('Ange en giltig e-postadress.'); return; }
    if (!villkor) { setFel('Du behöver godkänna villkoren för att fortsätta.'); return; }
    setFel(''); setLaddar(true);
    try {
      let p = await uppdateraProfil({
        fornamn: fornamn.trim(), efternamn: efternamn.trim(), email: email.trim(),
      });
      if (!p.villkor_godkanda) {
        await godkännVillkor();
        p = { ...p, villkor_godkanda: true };
      }
      await slutförInloggning(p);
    } catch (e) {
      setFel(felText(e, 'Kunde inte spara. Försök igen.'));
    } finally {
      setLaddar(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.logotyp}>
            <Text style={s.logo}>🧹</Text>
            <Text style={s.logoText}>serviceOS</Text>
            <Text style={s.sub}>Boka städning på en minut</Text>
          </View>

          <View style={s.kort}>
            {steg === 'telefon' && (
              <>
                <Text style={s.rubrik}>Logga in eller skapa konto</Text>
                <Text style={s.hjälp}>Vi skickar en kod via SMS. Inget lösenord behövs.</Text>
                <TextInput
                  style={s.input}
                  placeholder="Mobilnummer, t.ex. 070-123 45 67"
                  value={telefon}
                  onChangeText={setTelefon}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  returnKeyType="send"
                  onSubmitEditing={skicka}
                  placeholderTextColor="#9CA3AF"
                />
                <Knapp text="Skicka kod" onPress={skicka} laddar={laddar} />
              </>
            )}

            {steg === 'kod' && (
              <>
                <Text style={s.rubrik}>Ange koden</Text>
                <Text style={s.hjälp}>Vi skickade en 4-siffrig kod till {maskerat}.</Text>
                {devKod && (
                  <View style={s.devRuta}>
                    <Text style={s.devText}>Testläge (SMS ej aktiverat) — din kod: {devKod}</Text>
                  </View>
                )}
                <TextInput
                  ref={kodRef}
                  style={[s.input, s.kodInput]}
                  placeholder="••••"
                  value={kod}
                  onChangeText={(v) => {
                    const ren = v.replace(/[^0-9]/g, '').slice(0, 4);
                    setKod(ren);
                    if (ren.length === 4) verifiera(ren);
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={4}
                  placeholderTextColor="#D1D5DB"
                />
                <Knapp text="Logga in" onPress={() => verifiera()} laddar={laddar} inaktiv={kod.length !== 4} />
                <View style={s.länkRad}>
                  <TouchableOpacity onPress={() => { setSteg('telefon'); setFel(''); }}>
                    <Text style={s.länk}>Byt nummer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={skicka} disabled={laddar}>
                    <Text style={s.länk}>Skicka ny kod</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {steg === 'namn' && (
              <>
                <Text style={s.rubrik}>Välkommen! 👋</Text>
                <Text style={s.hjälp}>Berätta vem du är så att städaren vet vem som bokat.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[s.input, { flex: 1, minWidth: 0 }]} placeholder="Förnamn" value={fornamn}
                    onChangeText={setFornamn} autoComplete="given-name" placeholderTextColor="#9CA3AF" />
                  <TextInput style={[s.input, { flex: 1, minWidth: 0 }]} placeholder="Efternamn" value={efternamn}
                    onChangeText={setEfternamn} autoComplete="family-name" placeholderTextColor="#9CA3AF" />
                </View>
                <TextInput style={s.input} placeholder="E-post (för bokningsbekräftelser)" value={email}
                  onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
                  autoComplete="email" placeholderTextColor="#9CA3AF" />
                <TouchableOpacity style={s.villkorRad} onPress={() => setVillkor((v) => !v)} activeOpacity={0.7}>
                  <View style={[s.checkbox, villkor && s.checkboxVald]}>
                    {villkor && <Text style={{ color: '#fff', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={s.villkorText}>
                    Jag godkänner villkoren och{' '}
                    <Text style={s.länk} onPress={() => Linking.openURL(`${BASE_URL}/integritetspolicy/`)}>
                      integritetspolicyn
                    </Text>
                  </Text>
                </TouchableOpacity>
                <Knapp text="Kom igång" onPress={sparaNamn} laddar={laddar} />
              </>
            )}

            {!!fel && <Text style={s.fel}>{fel}</Text>}
          </View>

          <Text style={s.fotnot}>serviceOS · Nordisk städtjänst</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Knapp({ text, onPress, laddar, inaktiv }) {
  return (
    <TouchableOpacity
      style={[s.btn, (laddar || inaktiv) && s.btnInaktiv]}
      onPress={onPress}
      disabled={laddar || inaktiv}
      activeOpacity={0.85}
    >
      {laddar ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{text}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0FBF7' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  logotyp: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 56 },
  logoText: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginTop: 8 },
  sub: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  kort: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  rubrik: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  hjälp: { fontSize: 14, color: '#6B7280', marginBottom: 18, lineHeight: 20 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14, color: '#1A1A2E',
  },
  kodInput: { fontSize: 28, letterSpacing: 16, textAlign: 'center', fontWeight: '700' },
  devRuta: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginBottom: 14 },
  devText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  btn: { backgroundColor: TEAL, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnInaktiv: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  länkRad: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  länk: { color: TEAL, fontWeight: '600', fontSize: 14 },
  villkorRad: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  checkboxVald: { backgroundColor: TEAL, borderColor: TEAL },
  villkorText: { flex: 1, fontSize: 14, color: '#374151' },
  fel: { color: '#DC2626', fontSize: 14, marginTop: 14, textAlign: 'center' },
  fotnot: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 24 },
});
