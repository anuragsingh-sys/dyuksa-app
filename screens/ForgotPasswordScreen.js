import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function ForgotPasswordScreen({ navigation }) {
  const { validateEmail } = useContext(AuthContext);
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const errs = validateEmail(email);
    if (errs.length) { setError(errs[0]); return; }
    setLoading(true);
    // MOCK — replace with: await fetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>D</Text>
          </View>

          {!sent ? (
            <>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your email and we'll send you a reset link.
              </Text>

              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[styles.inputWrap, focused && styles.inputFocused, !!error && styles.inputError]}>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#AAAABC"
                  value={email}
                  onChangeText={t => { setEmail(t); setError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>
              {!!error && <Text style={styles.fieldError}>{error}</Text>}

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Send Reset Link</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>📧</Text>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSub}>
                We've sent a password reset link to{'\n'}
                <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>{email}</Text>
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  kav: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backBtn: { position: 'absolute', top: 16, left: 16, padding: 8 },
  backText: { color: '#888899', fontSize: 14, fontWeight: '500' },
  logoBox: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  logoLetter: { color: '#4ECDC4', fontSize: 22, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#888899', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F5', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 50, marginBottom: 4 },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  inputError: { borderColor: '#EF4444' },
  input: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  fieldError: { fontSize: 11, color: '#EF4444', marginBottom: 16, marginLeft: 2 },
  btn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  successBox: { alignItems: 'center', gap: 12 },
  successIcon: { fontSize: 48 },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  successSub: { fontSize: 13, color: '#888899', textAlign: 'center', lineHeight: 22 },
});
