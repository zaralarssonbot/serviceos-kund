import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../lib/alert';
import { useAuth } from '../context/AuthContext';

const TEAL = '#1D9E75';

export default function LoginScreen() {
  const { loggaIn } = useAuth();
  const [email, setEmail] = useState('');
  const [lösenord, setLösenord] = useState('');
  const [laddar, setLaddar] = useState(false);

  async function hanteraLogin() {
    if (!email || !lösenord) {
      Alert.alert('Fyll i alla fält');
      return;
    }
    setLaddar(true);
    try {
      await loggaIn(email.trim(), lösenord);
    } catch {
      Alert.alert('Fel', 'Felaktigt användarnamn eller lösenord');
    } finally {
      setLaddar(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.logotyp}>
          <Text style={s.logo}>🧹</Text>
          <Text style={s.logoText}>serviceOS</Text>
          <Text style={s.sub}>Din städtjänst i Norden</Text>
        </View>

        <View style={s.kort}>
          <Text style={s.rubrik}>Logga in</Text>
          <TextInput
            style={s.input}
            placeholder="E-post eller användarnamn"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            style={s.input}
            placeholder="Lösenord"
            value={lösenord}
            onChangeText={setLösenord}
            secureTextEntry
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            style={[s.btn, laddar && s.btnInaktiv]}
            onPress={hanteraLogin}
            disabled={laddar}
          >
            {laddar
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Logga in</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.fotnot}>serviceOS · Nordisk städtjänst</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0FBF7' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logotyp: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 56 },
  logoText: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginTop: 8 },
  sub: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  kort: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  rubrik: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 20 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14, color: '#1A1A2E',
  },
  btn: {
    backgroundColor: TEAL, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 4,
  },
  btnInaktiv: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fotnot: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 24 },
});
