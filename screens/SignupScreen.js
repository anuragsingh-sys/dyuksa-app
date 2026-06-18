import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
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

export default function SignupScreen({ navigation }) {
  const { signup }  = useContext(AuthContext);
  const insets      = useSafeAreaInsets();

  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState([]);
  const [fieldErrors,     setFieldErrors]     = useState({ name: '', email: '', password: '', confirm: '' });

  const clearFe = field => setFieldErrors(f => ({ ...f, [field]: '' }));

  const validate = () => {
    const e = { name: '', email: '', password: '', confirm: '' };
    let ok = true;
    if (!name.trim())                { e.name = 'Full name is required.'; ok = false; }
    else if (name.trim().length < 2) { e.name = 'Name must be at least 2 characters.'; ok = false; }
    if (!email.trim())               { e.email = 'Email is required.'; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { e.email = 'Enter a valid email.'; ok = false; }
    if (!password)                   { e.password = 'Password is required.'; ok = false; }
    else if (password.length < 8)    { e.password = 'At least 8 characters.'; ok = false; }
    else if (!/[A-Z]/.test(password)){ e.password = 'Include at least 1 uppercase letter.'; ok = false; }
    else if (!/\d/.test(password))   { e.password = 'Include at least 1 number.'; ok = false; }
    else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) { e.password = 'Include at least 1 special character.'; ok = false; }
    if (!confirmPassword)            { e.confirm = 'Please confirm your password.'; ok = false; }
    else if (password !== confirmPassword) { e.confirm = 'Passwords do not match.'; ok = false; }
    setFieldErrors(e);
    return ok;
  };

  const handleSignup = async () => {
    setErrors([]);
    if (!validate()) return;
    setLoading(true);
    const result = await signup(name, email, password, confirmPassword);
    setLoading(false);
    if (!result.success) setErrors(result.errors);
  };

  const Field = ({ label, value, onChange, field, placeholder, secure, showToggle, onToggle, keyboard }) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, !!fieldErrors[field] && { borderColor: '#EF4444' }]}>
        <TextInput
          style={s.inputInner}
          placeholder={placeholder}
          placeholderTextColor="#9AA3B2"
          value={value}
          onChangeText={t => { onChange(t); clearFe(field); }}
          secureTextEntry={!!secure}
          autoCapitalize={field === 'name' ? 'words' : 'none'}
          keyboardType={keyboard || 'default'}
          autoComplete={field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'off'}
        />
        {showToggle && (
          <TouchableOpacity onPress={onToggle} style={{ padding: 4 }}>
            <EyeIcon visible={!secure} color="#9AA3B2" />
          </TouchableOpacity>
        )}
      </View>
      {!!fieldErrors[field] && <Text style={s.fieldError}>{fieldErrors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#6B7588', fontSize: 28, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>

          {/* Brand */}
          <View style={s.brandRow}>
            <DyuksaLogo />
            <Text style={s.brandName}>Dyuksa</Text>
          </View>

          <Text style={s.title}>Create account</Text>
          <Text style={s.subtitle}>Join Dyuksa and start managing your work</Text>

          {/* Global errors */}
          {errors.length > 0 && (
            <View style={s.errorBox}>
              {errors.map((e, i) => <Text key={i} style={s.errorText}>• {e}</Text>)}
            </View>
          )}

          <Field label="Full Name"       value={name}            onChange={setName}            field="name"     placeholder="Anurag Singh" />
          <Field label="Email Address"   value={email}           onChange={setEmail}           field="email"    placeholder="you@dyuksa.com" keyboard="email-address" />
          <Field label="Password"        value={password}        onChange={setPassword}        field="password" placeholder="Min. 8 chars, uppercase, number, special" secure={!showPass}    showToggle onToggle={() => setShowPass(v => !v)} />
          <PasswordStrength password={password} />
          <Field label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} field="confirm"  placeholder="Re-enter your password" secure={!showConfirm} showToggle onToggle={() => setShowConfirm(v => !v)} />

          {/* Create account button */}
          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Create account</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerTxt}>or continue with</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Social */}
          <View style={s.socialRow}>
            {['Google', 'Apple', 'SSO'].map(p => (
              <TouchableOpacity key={p} style={s.socialBtn} activeOpacity={0.7}>
                <Text style={s.socialTxt}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign in */}
          <View style={s.loginRow}>
            <Text style={s.loginPrompt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLink}>Sign in</Text>
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
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  brandName: { fontSize: 20, fontWeight: '700', color: '#0E1726' },
  title:     { fontSize: 26, fontWeight: '800', color: '#0E1726', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:  { fontSize: 14, color: '#6B7588', marginBottom: 24 },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },

  label:     { fontSize: 12, fontWeight: '600', color: '#6B7588', marginBottom: 6, letterSpacing: 0.2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F6FA', borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 52, marginBottom: 4 },
  inputInner:{ flex: 1, fontSize: 15, color: '#0E1726' },
  fieldError:{ fontSize: 11, color: '#EF4444', marginBottom: 10, marginLeft: 2 },

  btn:       { backgroundColor: ACCENT, borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 20, shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  btnTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E6E9EF' },
  dividerTxt:  { fontSize: 12, color: '#9AA3B2' },

  socialRow:   { flexDirection: 'row', gap: 10, marginBottom: 24 },
  socialBtn:   { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E6E9EF', justifyContent: 'center', alignItems: 'center' },
  socialTxt:   { fontSize: 14, fontWeight: '600', color: '#0E1726' },

  loginRow:    { flexDirection: 'row', justifyContent: 'center' },
  loginPrompt: { color: '#6B7588', fontSize: 14 },
  loginLink:   { color: ACCENT, fontSize: 14, fontWeight: '700' },
});
