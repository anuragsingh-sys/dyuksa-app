import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api';
import { SIGNUP_PRODUCTS } from '../../types/index';
import Svg, { Path, Rect } from 'react-native-svg';

const ACCENT = '#3B72EE';

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

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)                                     score++;
  if (/[A-Z]/.test(password))                                   score++;
  if (/\d/.test(password))                                      score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  const label  = ['Weak', 'Fair', 'Good', 'Strong'][score - 1] || 'Weak';
  const colors = ['#EF4444', '#F59E0B', ACCENT, '#22C55E'];
  const color  = colors[score - 1] || '#EF4444';
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= score ? color : '#E6E9EF' }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color, fontWeight: '600' }}>{label} password</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 1 — Email
// ═══════════════════════════════════════════════════════════════════════
const StepEmail = ({ email, setEmail, error, loading, onSubmit, onLogin }) => (
  <>
    <Text style={s.title}>Create account</Text>
    <Text style={s.subtitle}>Set up your organisation on Dyuksa</Text>

    {!!error && (
      <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
    )}

    <Text style={s.label}>Work Email</Text>
    <TextInput
      style={s.input}
      placeholder="you@company.com"
      placeholderTextColor="#9AA3B2"
      value={email}
      onChangeText={setEmail}
      autoCapitalize="none"
      keyboardType="email-address"
      autoComplete="email"
    />

    <TouchableOpacity
      style={[s.btn, loading && { opacity: 0.7 }]}
      onPress={onSubmit}
      disabled={loading}
      activeOpacity={0.88}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Continue</Text>}
    </TouchableOpacity>

    <View style={s.loginRow}>
      <Text style={s.loginPrompt}>Already have an account? </Text>
      <TouchableOpacity onPress={onLogin}>
        <Text style={s.loginLink}>Sign in</Text>
      </TouchableOpacity>
    </View>
  </>
);

// ═══════════════════════════════════════════════════════════════════════
// STEP 2 — Company + Password + OTP
// ═══════════════════════════════════════════════════════════════════════
const StepForm = ({
  email, companyName, setCompanyName, password, setPassword,
  passwordConfirm, setPasswordConfirm, otp, setOtp,
  error, loading, countdown, onSubmit, onResendOtp, onBack,
}) => {
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  return (
    <>
      <Text style={s.title}>Complete your profile</Text>
      <Text style={s.subtitle}>Enter your details and verify your email</Text>

      {!!error && (
        <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
      )}

      <Text style={s.label}>Company Name</Text>
      <TextInput
        style={s.input}
        placeholder="Your company name"
        placeholderTextColor="#9AA3B2"
        value={companyName}
        onChangeText={setCompanyName}
        autoCapitalize="words"
      />

      <Text style={s.label}>Email</Text>
      <View style={[s.inputWrap, { backgroundColor: '#F0F2F6' }]}>
        <Text style={{ flex: 1, fontSize: 14, color: '#6B7588' }} numberOfLines={1}>{email}</Text>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Password</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.inputInner}
          placeholder="Min. 8 chars, uppercase, number, special"
          placeholderTextColor="#9AA3B2"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
          <EyeIcon visible={showPass} color="#9AA3B2" />
        </TouchableOpacity>
      </View>
      <PasswordStrength password={password} />

      <Text style={s.label}>Confirm Password</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.inputInner}
          placeholder="Re-enter your password"
          placeholderTextColor="#9AA3B2"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showConf}
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <TouchableOpacity onPress={() => setShowConf(v => !v)} style={{ padding: 4 }}>
          <EyeIcon visible={showConf} color="#9AA3B2" />
        </TouchableOpacity>
      </View>

      <Text style={s.label}>OTP Code</Text>
      <TextInput
        style={[s.input, { textAlign: 'center', letterSpacing: 6 }]}
        placeholder="Enter 6-digit OTP"
        placeholderTextColor="#9AA3B2"
        value={otp}
        onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
      />
      <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
        {countdown > 0 ? (
          <Text style={{ fontSize: 12, color: '#9AA3B2' }}>Resend OTP in {countdown}s</Text>
        ) : (
          <TouchableOpacity onPress={onResendOtp}>
            <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '600' }}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[s.btn, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.88}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#6B7588' }}>← Back</Text>
      </TouchableOpacity>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 3 — Product Selection
// ═══════════════════════════════════════════════════════════════════════
const StepProducts = ({ selectedProducts, onToggle, loading, onGetStarted, onSkip, onBack }) => (
  <>
    <Text style={[s.title, { textAlign: 'center' }]}>Which Dyuksa products do you want?</Text>
    <Text style={[s.subtitle, { textAlign: 'center' }]}>PM is included. Select any others you need.</Text>

    {SIGNUP_PRODUCTS.map(product => {
      const isSelected = selectedProducts.includes(product.key);
      return (
        <TouchableOpacity
          key={product.key}
          activeOpacity={product.locked ? 1 : 0.7}
          onPress={() => !product.locked && onToggle(product.key)}
          style={[
            s.productCard,
            isSelected && { borderColor: ACCENT, backgroundColor: ACCENT + '08' },
          ]}
        >
          <Text style={{ fontSize: 24 }}>{product.icon}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0E1726' }}>{product.name}</Text>
              {product.locked && (
                <View style={{ backgroundColor: ACCENT + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: ACCENT, fontWeight: '600' }}>Included</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: '#6B7588', marginTop: 2 }}>{product.description}</Text>
          </View>
          <View style={[
            s.checkbox,
            isSelected && { backgroundColor: ACCENT, borderColor: ACCENT },
          ]}>
            {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
          </View>
        </TouchableOpacity>
      );
    })}

    <TouchableOpacity
      style={[s.btn, { marginTop: 16 }, loading && { opacity: 0.7 }]}
      onPress={onGetStarted}
      disabled={loading}
      activeOpacity={0.88}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Get Started</Text>}
    </TouchableOpacity>

    <TouchableOpacity onPress={onSkip} disabled={loading} style={{ marginTop: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#6B7588' }}>Skip for now — PM only</Text>
    </TouchableOpacity>

    <TouchableOpacity onPress={onBack} style={{ marginTop: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#6B7588' }}>← Back</Text>
    </TouchableOpacity>
  </>
);

// ═══════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════
const SuccessScreen = () => (
  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E18', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
      <Text style={{ fontSize: 32 }}>✅</Text>
    </View>
    <Text style={{ fontSize: 22, fontWeight: '700', color: '#0E1726', marginBottom: 8 }}>Account Created!</Text>
    <Text style={{ fontSize: 14, color: '#6B7588', textAlign: 'center' }}>Your workspace is being set up. Redirecting to dashboard…</Text>
    <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
  </View>
);

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function SignupScreen({ navigation }) {
  const { registerAndLogin } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  // ── Form state ───────────────────────────────────────────────────
  const [step, setStep]                       = useState(1);
  const [email, setEmail]                     = useState('');
  const [companyName, setCompanyName]         = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [otp, setOtp]                         = useState('');
  const [selectedProducts, setSelectedProducts] = useState(['pm']);

  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(0);

  // ── OTP countdown timer ──────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ── Step 1: Send OTP ─────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOtp(trimmed);
      setStep(2);
      setCountdown(120);
    } catch (err) {
      const data = err.data;
      const isExists = err.status === 409 ||
        (err.status === 400 && (data?.code === 'EMAIL_ALREADY_EXISTS' ||
          (data?.detail || data?.email?.[0] || '').toLowerCase().includes('already exist')));
      if (isExists) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Please log in instead.',
          [
            { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
            { text: 'OK' },
          ]
        );
        return;
      }
      setError(data?.detail || data?.email?.[0] || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, navigation]);

  // ── Step 2: Validate form → go to products ───────────────────────
  const handleVerifyAndProceed = useCallback(() => {
    setError('');
    if (!companyName.trim()) { setError('Company name is required.'); return; }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(password)) { setError('Include at least 1 uppercase letter.'); return; }
    if (!/\d/.test(password)) { setError('Include at least 1 number.'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) { setError('Include at least 1 special character.'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match.'); return; }
    if (!otp || otp.length < 4) { setError('Enter the OTP sent to your email.'); return; }
    setStep(3);
  }, [companyName, password, passwordConfirm, otp]);

  // ── Step 3: Submit registration ──────────────────────────────────
  const handleRegister = useCallback(async (products) => {
    setError('');
    setLoading(true);
    try {
      const response = await authApi.register({
        company_name:     companyName.trim(),
        admin_email:      email.trim().toLowerCase(),
        password,
        password_confirm: passwordConfirm,
        otp,
        platform:         'pm',
        products,
      });

      // Registration succeeded — set up authenticated session
      const tokens = response.tokens;
      const workspaceId = response.workspace?.id || null;
      await registerAndLogin(tokens, workspaceId);

      setStep('success');
      // Auto-navigate to dashboard after 2 seconds
      setTimeout(() => {
        // Navigation resets because AuthContext.isAuthenticated is now true,
        // which triggers the navigator to show the main app stack
      }, 2000);
    } catch (err) {
      const data = err.data;
      if (err.status === 409 && data?.code === 'EMAIL_ALREADY_EXISTS') {
        Alert.alert('Account Exists', 'An account with this email already exists.', [
          { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
          { text: 'OK' },
        ]);
        setStep(2);
        return;
      }
      setError(
        data?.otp?.[0] ||
        data?.detail ||
        data?.admin_email?.[0] ||
        data?.company_name?.[0] ||
        'Registration failed. Please try again.'
      );
      setStep(2);
    } finally {
      setLoading(false);
    }
  }, [companyName, email, password, passwordConfirm, otp, registerAndLogin, navigation]);

  const toggleProduct = useCallback((key) => {
    if (key === 'pm') return;
    setSelectedProducts(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step !== 'success' && (
            <>
              <TouchableOpacity style={s.backBtn} onPress={() => {
                if (step === 1) navigation.goBack();
                else if (step === 2) { setStep(1); setError(''); setOtp(''); }
                else if (step === 3) { setStep(2); setError(''); }
              }}>
                <Text style={{ color: '#6B7588', fontSize: 28, fontWeight: '300' }}>‹</Text>
              </TouchableOpacity>

              <View style={s.brandRow}>
                <DyuksaLogo />
                <Text style={s.brandName}>Dyuksa</Text>
              </View>
            </>
          )}

          {step === 1 && (
            <StepEmail
              email={email}
              setEmail={(t) => { setEmail(t); setError(''); }}
              error={error}
              loading={loading}
              onSubmit={handleSendOtp}
              onLogin={() => navigation.navigate('Login')}
            />
          )}

          {step === 2 && (
            <StepForm
              email={email.trim().toLowerCase()}
              companyName={companyName}
              setCompanyName={(t) => { setCompanyName(t); setError(''); }}
              password={password}
              setPassword={(t) => { setPassword(t); setError(''); }}
              passwordConfirm={passwordConfirm}
              setPasswordConfirm={(t) => { setPasswordConfirm(t); setError(''); }}
              otp={otp}
              setOtp={(t) => { setOtp(t); setError(''); }}
              error={error}
              loading={loading}
              countdown={countdown}
              onSubmit={handleVerifyAndProceed}
              onResendOtp={handleSendOtp}
              onBack={() => { setStep(1); setError(''); setOtp(''); }}
            />
          )}

          {step === 3 && (
            <StepProducts
              selectedProducts={selectedProducts}
              onToggle={toggleProduct}
              loading={loading}
              onGetStarted={() => handleRegister(selectedProducts)}
              onSkip={() => handleRegister(['pm'])}
              onBack={() => { setStep(2); setError(''); }}
            />
          )}

          {step === 'success' && <SuccessScreen />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 },

  backBtn:   { marginBottom: 8 },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  brandName: { fontSize: 20, fontWeight: '700', color: '#0E1726' },
  title:     { fontSize: 26, fontWeight: '800', color: '#0E1726', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:  { fontSize: 14, color: '#6B7588', marginBottom: 24 },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },

  label:     { fontSize: 12, fontWeight: '600', color: '#6B7588', marginBottom: 6, letterSpacing: 0.2 },
  input:     { backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, fontSize: 15, color: '#0E1726', marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, marginBottom: 4 },
  inputInner:{ flex: 1, fontSize: 15, color: '#0E1726' },

  btn:       { backgroundColor: ACCENT, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 12, shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  btnTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },

  loginRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  loginPrompt: { color: '#6B7588', fontSize: 14 },
  loginLink:   { color: ACCENT, fontSize: 14, fontWeight: '700' },

  productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: '#E6E9EF', backgroundColor: '#fff', marginBottom: 10 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D0D5E8', justifyContent: 'center', alignItems: 'center' },
});