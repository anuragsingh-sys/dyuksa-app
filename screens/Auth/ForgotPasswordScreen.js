import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api';
import Svg, { Path, Rect } from 'react-native-svg';

const ACCENT = '#3B72EE';

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

export default function ForgotPasswordScreen({ navigation }) {
  const { validateEmail } = useContext(AuthContext);

  // ── State ─────────────────────────────────────────────────────────
  const [step, setStep]             = useState(1); // 1=email, 2=otp, 3=new password, 4=success
  const [email, setEmail]           = useState('');
  const [otp, setOtp]               = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [countdown, setCountdown]   = useState(0);

  // ── Countdown timer for OTP resend ────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ── Step 1: Send OTP to email ─────────────────────────────────────
  const handleSendOtp = async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    const errs = validateEmail ? validateEmail(trimmed) : (!trimmed.includes('@') ? ['Enter a valid email address.'] : []);
    if (errs?.length) { setError(errs[0]); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(trimmed);
      setStep(2);
      setCountdown(120);
    } catch (e) {
      setError('Could not send OTP. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setError('');
    if (!otp || otp.length < 4) { setError('Enter the OTP sent to your email.'); return; }
    setLoading(true);
    try {
      const data = await authApi.verifyOtp(email.trim().toLowerCase(), otp);
      setResetToken(data.reset_token);
      setStep(3);
    } catch (e) {
      const msg = e.data?.detail || e.data?.otp?.[0] || 'Invalid OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Set new password ──────────────────────────────────────
  const handleSetNewPassword = async () => {
    setError('');
    if (!newPassword) { setError('Password is required.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(newPassword)) { setError('Include at least 1 uppercase letter.'); return; }
    if (!/\d/.test(newPassword)) { setError('Include at least 1 number.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authApi.setNewPassword({
        email: email.trim().toLowerCase(),
        reset_token: resetToken,
        password: newPassword,
        password_confirm: confirmPassword,
      });
      setStep(4);
    } catch (e) {
      const msg = e.data?.detail || e.data?.password?.[0] || 'Failed to reset password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          {step !== 4 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => {
              if (step === 1) navigation.goBack();
              else if (step === 2) { setStep(1); setError(''); setOtp(''); }
              else if (step === 3) { setStep(2); setError(''); }
            }}>
              <Text style={{ color: '#6B7588', fontSize: 28, fontWeight: '300', marginTop: -3 }}>‹</Text>
            </TouchableOpacity>
          )}

          {/* Logo */}
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>D</Text>
          </View>

          {/* ── STEP 1: Enter email ──────────────────────────────── */}
          {step === 1 && (
            <>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>Enter your email and we'll send you an OTP to reset your password.</Text>

              {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#9AA3B2"
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#6B7588' }}>
                  Back to <Text style={{ color: ACCENT, fontWeight: '600' }}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2: Enter OTP ────────────────────────────────── */}
          {step === 2 && (
            <>
              <Text style={styles.title}>Verify OTP</Text>
              <Text style={styles.subtitle}>
                We sent a code to{'\n'}
                <Text style={{ fontWeight: '700', color: '#0E1726' }}>{email.trim().toLowerCase()}</Text>
              </Text>

              {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

              <Text style={styles.fieldLabel}>Enter OTP</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 20 }]}
                placeholder="••••••"
                placeholderTextColor="#9AA3B2"
                value={otp}
                onChangeText={t => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                keyboardType="number-pad"
                maxLength={6}
              />

              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                {countdown > 0 ? (
                  <Text style={{ fontSize: 12, color: '#9AA3B2' }}>Resend OTP in {countdown}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp}>
                    <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '600' }}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setStep(1); setError(''); setOtp(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#6B7588' }}>← Try a different email</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 3: Set new password ─────────────────────────── */}
          {step === 3 && (
            <>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>Set your new secure password</Text>

              {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Min. 8 chars, uppercase, number"
                  placeholderTextColor="#9AA3B2"
                  value={newPassword}
                  onChangeText={t => { setNewPassword(t); setError(''); }}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                  <EyeIcon visible={showPass} color="#9AA3B2" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#9AA3B2"
                  value={confirmPassword}
                  onChangeText={t => { setConfirmPassword(t); setError(''); }}
                  secureTextEntry={!showConf}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowConf(v => !v)} style={{ padding: 4 }}>
                  <EyeIcon visible={showConf} color="#9AA3B2" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSetNewPassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 4: Success ──────────────────────────────────── */}
          {step === 4 && (
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E18', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 32 }}>✅</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0E1726', marginBottom: 8 }}>Password Reset!</Text>
              <Text style={{ fontSize: 14, color: '#6B7588', textAlign: 'center', lineHeight: 22 }}>
                Your password has been reset successfully.{'\n'}You can now sign in with your new password.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { marginTop: 24, width: '100%' }]}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 },

  backBtn: { position: 'absolute', top: 16, left: 0, padding: 8 },

  logoBox:    { width: 56, height: 56, borderRadius: 14, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24 },
  logoLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },

  title:    { fontSize: 24, fontWeight: '700', color: '#0E1726', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#6B7588', textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7588', marginBottom: 6, letterSpacing: 0.3 },
  input:      { backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, fontSize: 15, color: '#0E1726', marginBottom: 4 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, marginBottom: 4 },
  inputInner: { flex: 1, fontSize: 15, color: '#0E1726' },

  btn:     { backgroundColor: ACCENT, borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});