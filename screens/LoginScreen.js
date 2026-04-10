import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState([]);
  const [fieldErrors,  setFieldErrors]  = useState({ email: '', password: '' });

  const validateFields = () => {
    const fe = { email: '', password: '' };
    let valid = true;
    if (!email.trim()) { fe.email = 'Email is required.'; valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { fe.email = 'Enter a valid email.'; valid = false; }
    if (!password) { fe.password = 'Password is required.'; valid = false; }
    else if (password.length < 8) { fe.password = 'Password must be at least 8 characters.'; valid = false; }
    setFieldErrors(fe);
    return valid;
  };

  const handleLogin = async () => {
    setErrors([]);
    if (!validateFields()) return;
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      setErrors(result.errors);
    }
    // On success, AuthContext sets token → App.js auto-navigates to Main
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

            {/* Logo */}
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Text style={styles.logoLetter}>D</Text>
              </View>
            </View>
            <Text style={styles.title}>Welcome To DYUKSA</Text>
            <Text style={styles.subtitle}>Sign in to your account to continue</Text>

            {/* Global errors */}
            {errors.length > 0 && (
              <View style={styles.errorBox}>
                {errors.map((e, i) => (
                  <Text key={i} style={styles.errorText}>• {e}</Text>
                ))}
              </View>
            )}

            {/* Email */}
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={[styles.inputWrap, emailFocused && styles.inputFocused, !!fieldErrors.email && styles.inputError]}>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#AAAABC"
                value={email}
                onChangeText={t => { setEmail(t); setFieldErrors(f => ({ ...f, email: '' })); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
            {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}

            {/* Password */}
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.inputWrap, passFocused && styles.inputFocused, !!fieldErrors.password && styles.inputError]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min. 8 characters"
                placeholderTextColor="#AAAABC"
                value={password}
                onChangeText={t => { setPassword(t); setFieldErrors(f => ({ ...f, password: '' })); }}
                secureTextEntry={!showPass}
                autoComplete="password"
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPass(s => !s)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signInText}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* Sign Up */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpPrompt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  logoBox: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoLetter: { color: '#4ECDC4', fontSize: 22, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888899', textAlign: 'center', marginBottom: 20 },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F5', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, marginBottom: 4, height: 50 },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  fieldError: { fontSize: 11, color: '#EF4444', marginBottom: 12, marginLeft: 2 },
  forgotRow: { alignItems: 'flex-end', marginBottom: 20, marginTop: 4 },
  forgotText: { color: '#4ECDC4', fontSize: 13, fontWeight: '500' },
  signInBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  signInText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center' },
  signUpPrompt: { color: '#888899', fontSize: 13 },
  signUpLink: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
});
