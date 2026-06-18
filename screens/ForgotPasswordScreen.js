import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../config';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const ACCENT = '#3B72EE';

const MailIcon = ({ color, size = 48 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={1.5}/>
    <Path d="M2 7l10 7 10-7" stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
  </Svg>
);

export default function ForgotPasswordScreen({ navigation }) {
  const { validateEmail } = useContext(AuthContext);
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const errs = validateEmail ? validateEmail(email) : (!email.includes('@') ? ['Enter a valid email address.'] : []);
    if (errs?.length) { setError(errs[0]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Most APIs return 200 even if email not found (security)
      setSent(true);
    } catch (e) {
      setError('Could not send reset link. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#6B7588', fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
          </TouchableOpacity>

          {/* Logo */}
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
              <View style={[
                styles.inputWrap,
                focused && { borderColor: ACCENT, backgroundColor: '#fff' },
                !!error && { borderColor: '#EF4444' },
              ]}>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#9AA3B2"
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
                style={[styles.btn, { backgroundColor: ACCENT, opacity: loading ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Send Reset Link</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#6B7588' }}>
                  Back to <Text style={{ color: ACCENT, fontWeight: '600' }}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successBox}>
              <View style={[styles.successIconWrap, { backgroundColor: ACCENT + '15' }]}>
                <MailIcon color={ACCENT} size={36} />
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSub}>
                We've sent a password reset link to{'\n'}
                <Text style={{ fontWeight: '700', color: '#0E1726' }}>{email}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: '#9AA3B2', textAlign: 'center', marginTop: 4 }}>
                Didn't receive it? Check your spam folder.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: ACCENT, marginTop: 24, width: '100%' }]}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSent(false); setEmail(''); }} style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, color: ACCENT, fontWeight: '600' }}>Try a different email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  backBtn: { position: 'absolute', top: 16, left: 12, padding: 8 },

  logoBox:    { width: 56, height: 56, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24 },
  logoLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },

  title:    { fontSize: 24, fontWeight: '700', color: '#0E1726', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#6B7588', textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7588', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap:  { backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, justifyContent: 'center', marginBottom: 4 },
  input:      { fontSize: 15, color: '#0E1726' },
  fieldError: { fontSize: 11, color: '#EF4444', marginBottom: 12, marginLeft: 2 },

  btn:     { borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  successBox:     { alignItems: 'center', gap: 10 },
  successIconWrap:{ width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  successTitle:   { fontSize: 22, fontWeight: '700', color: '#0E1726' },
  successSub:     { fontSize: 13, color: '#6B7588', textAlign: 'center', lineHeight: 22 },
});
