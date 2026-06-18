import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Svg, { Path, Rect } from 'react-native-svg';

const ACCENT = '#3B72EE';

// Dyuksa logo icon (D shape)
const DyuksaLogo = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Rect width="32" height="32" rx="8" fill={ACCENT}/>
    <Path d="M10 8h6a8 8 0 010 16h-6V8z" fill="#fff"/>
  </Svg>
);

const EyeIcon = ({ visible, color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" stroke={color} strokeWidth={2}/>
      </>
    ) : (
      <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    )}
  </Svg>
);

export default function LoginScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const insets    = useSafeAreaInsets();

  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [keepSigned,  setKeepSigned]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState([]);
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });

  const validate = () => {
    const fe = { username: '', password: '' };
    let valid = true;
    if (!username.trim()) { fe.username = 'Username is required.'; valid = false; }
    if (!password)         { fe.password = 'Password is required.'; valid = false; }
    setFieldErrors(fe);
    return valid;
  };

  const handleLogin = async () => {
    setErrors([]);
    setFieldErrors({ username: '', password: '' });
    if (!validate()) return;
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      const msg = result.errors?.[0] || 'Login failed.';
      if (result.errorField === 'password')      setFieldErrors({ username: '', password: msg });
      else if (result.errorField === 'username') setFieldErrors({ username: msg, password: '' });
      else if (result.errorField === 'both')     setFieldErrors({ username: msg, password: msg });
      else                                        setErrors([msg]);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back arrow */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#6B7588', fontSize: 28, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>

          {/* Logo + brand */}
          <View style={s.brandRow}>
            <DyuksaLogo />
            <Text style={s.brandName}>Dyuksa</Text>
          </View>

          {/* Heading */}
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to continue to your workspace</Text>

          {/* Global error */}
          {errors.length > 0 && (
            <View style={s.errorBox}>
              {errors.map((e, i) => <Text key={i} style={s.errorText}>• {e}</Text>)}
            </View>
          )}

          {/* Username */}
          <Text style={s.label}>Work email</Text>
          <TextInput
            style={[s.input, !!fieldErrors.username && { borderColor: '#EF4444' }]}
            placeholder="you@dyuksa.com"
            placeholderTextColor="#9AA3B2"
            value={username}
            onChangeText={t => { setUsername(t); setFieldErrors(f => ({ ...f, username: '' })); }}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="email-address"
          />
          {!!fieldErrors.username && <Text style={s.fieldError}>{fieldErrors.username}</Text>}

          {/* Password */}
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, !!fieldErrors.password && { borderColor: '#EF4444' }]}>
            <TextInput
              style={[s.inputInner]}
              placeholder="••••••••"
              placeholderTextColor="#9AA3B2"
              value={password}
              onChangeText={t => { setPassword(t); setFieldErrors(f => ({ ...f, password: '' })); }}
              secureTextEntry={!showPass}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={s.forgotInline}>
              <Text style={s.forgotTxt}>Forgot?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
              <EyeIcon visible={showPass} color="#9AA3B2" />
            </TouchableOpacity>
          </View>
          {!!fieldErrors.password && <Text style={s.fieldError}>{fieldErrors.password}</Text>}

          {/* Keep me signed in */}
          <TouchableOpacity style={s.keepRow} onPress={() => setKeepSigned(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, keepSigned && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
              {keepSigned && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
            </View>
            <Text style={s.keepTxt}>Keep me signed in</Text>
          </TouchableOpacity>

          {/* Sign In */}
          <TouchableOpacity
            style={[s.signInBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.signInTxt}>Sign in</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerTxt}>or continue with</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={s.socialRow}>
            {['Google', 'Apple', 'SSO'].map(provider => (
              <TouchableOpacity key={provider} style={s.socialBtn} activeOpacity={0.7}>
                <Text style={s.socialTxt}>{provider}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign up */}
          <View style={s.signUpRow}>
            <Text style={s.signUpPrompt}>New to Dyuksa? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={s.signUpLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 },

  backBtn:   { marginBottom: 8 },

  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandName: { fontSize: 20, fontWeight: '700', color: '#0E1726' },

  title:    { fontSize: 26, fontWeight: '800', color: '#0E1726', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7588', marginBottom: 28 },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },

  label:     { fontSize: 12, fontWeight: '600', color: '#6B7588', marginBottom: 6, letterSpacing: 0.2 },
  input:     { backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, fontSize: 15, color: '#0E1726', marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, marginBottom: 4 },
  inputInner:{ flex: 1, fontSize: 15, color: '#0E1726' },
  forgotInline:{ paddingHorizontal: 6 },
  forgotTxt: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  fieldError:{ fontSize: 11, color: '#EF4444', marginBottom: 12, marginLeft: 2 },

  keepRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 22 },
  checkbox:  { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#D0D5E8', justifyContent: 'center', alignItems: 'center' },
  keepTxt:   { fontSize: 14, color: '#0E1726' },

  signInBtn: { backgroundColor: ACCENT, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, marginBottom: 20 },
  signInTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E6E9EF' },
  dividerTxt:  { fontSize: 12, color: '#9AA3B2' },

  socialRow:  { flexDirection: 'row', gap: 10, marginBottom: 28 },
  socialBtn:  { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E6E9EF', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  socialTxt:  { fontSize: 14, fontWeight: '600', color: '#0E1726' },

  signUpRow:    { flexDirection: 'row', justifyContent: 'center' },
  signUpPrompt: { color: '#6B7588', fontSize: 14 },
  signUpLink:   { color: ACCENT, fontSize: 14, fontWeight: '700' },
});
