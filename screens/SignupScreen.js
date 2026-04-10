import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)                                       score++;
  if (/[A-Z]/.test(password))                                     score++;
  if (/\d/.test(password))                                        score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))   score++;

  const label  = ['Weak', 'Fair', 'Good', 'Strong'][score - 1] || 'Weak';
  const colors = ['#EF4444', '#F59E0B', '#4ECDC4', '#4ADE80'];
  const color  = colors[score - 1] || '#EF4444';

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= score ? color : '#EBEBF0' }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color, fontWeight: '600' }}>{label} password</Text>
    </View>
  );
};

export default function SignupScreen({ navigation }) {
  const { signup } = useContext(AuthContext);

  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState([]);
  const [fieldErrors,     setFieldErrors]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [focused,         setFocused]         = useState({});

  const fe = (field) => setFocused(f => ({ ...f, [field]: true }));
  const fb = (field) => setFocused(f => ({ ...f, [field]: false }));
  const clearFe = (field) => setFieldErrors(f => ({ ...f, [field]: '' }));

  const validate = () => {
    const errs = { name: '', email: '', password: '', confirm: '' };
    let ok = true;

    if (!name.trim())            { errs.name = 'Full name is required.'; ok = false; }
    else if (name.trim().length < 2) { errs.name = 'Name must be at least 2 characters.'; ok = false; }

    if (!email.trim())           { errs.email = 'Email is required.'; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { errs.email = 'Enter a valid email.'; ok = false; }

    if (!password)               { errs.password = 'Password is required.'; ok = false; }
    else if (password.length < 8) { errs.password = 'At least 8 characters.'; ok = false; }
    else if (!/[A-Z]/.test(password)) { errs.password = 'At least 1 uppercase letter.'; ok = false; }
    else if (!/\d/.test(password))    { errs.password = 'At least 1 number.'; ok = false; }
    else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) { errs.password = 'At least 1 special character (!@#$...).'; ok = false; }

    if (!confirmPassword)        { errs.confirm = 'Please confirm your password.'; ok = false; }
    else if (password !== confirmPassword) { errs.confirm = 'Passwords do not match.'; ok = false; }

    setFieldErrors(errs);
    return ok;
  };

  const handleSignup = async () => {
    setErrors([]);
    if (!validate()) return;
    setLoading(true);
    const result = await signup(name, email, password, confirmPassword);
    setLoading(false);
    if (!result.success) setErrors(result.errors);
    // On success AuthContext sets token → App navigates to Main automatically
  };

  const Field = ({ label, value, onChangeText, field, placeholder, secure, showToggle, onToggle, keyboard }) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused[field] && styles.inputFocused, !!fieldErrors[field] && styles.inputError]}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor="#AAAABC"
          value={value}
          onChangeText={t => { onChangeText(t); clearFe(field); }}
          secureTextEntry={secure}
          autoCapitalize={field === 'name' ? 'words' : 'none'}
          keyboardType={keyboard || 'default'}
          autoComplete={field === 'email' ? 'email' : field === 'password' ? 'new-password' : 'off'}
          onFocus={() => fe(field)}
          onBlur={() => fb(field)}
        />
        {showToggle && (
          <TouchableOpacity onPress={onToggle} style={{ padding: 4 }}>
            <Text style={{ fontSize: 16 }}>{secure ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!fieldErrors[field] && <Text style={styles.fieldError}>{fieldErrors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

            <View style={styles.logoRow}>
              <View style={styles.logoBox}><Text style={styles.logoLetter}>D</Text></View>
            </View>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join DYUKSA and start managing your work</Text>

            {errors.length > 0 && (
              <View style={styles.errorBox}>
                {errors.map((e, i) => <Text key={i} style={styles.errorText}>• {e}</Text>)}
              </View>
            )}

            <Field label="Full Name" value={name} onChangeText={setName} field="name" placeholder="Anurag Singh" />
            <Field label="Email Address" value={email} onChangeText={setEmail} field="email" placeholder="you@example.com" keyboard="email-address" />
            <Field
              label="Password" value={password} onChangeText={setPassword} field="password"
              placeholder="Min. 8 chars, 1 uppercase, 1 number, 1 special"
              secure={!showPass} showToggle onToggle={() => setShowPass(s => !s)}
            />
            <PasswordStrength password={password} />
            <Field
              label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} field="confirm"
              placeholder="Re-enter your password"
              secure={!showConfirm} showToggle onToggle={() => setShowConfirm(s => !s)}
            />

            <TouchableOpacity
              style={[styles.signUpBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signUpBtnText}>Create Account</Text>
              }
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
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
  logoRow: { alignItems: 'center', marginBottom: 16 },
  logoBox: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoLetter: { color: '#4ECDC4', fontSize: 22, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888899', textAlign: 'center', marginBottom: 20 },
  errorBox: { backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 12, color: '#EF4444', lineHeight: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#888899', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F5', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, height: 50 },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#fff' },
  input: { fontSize: 15, color: '#1A1A2E' },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 4, marginLeft: 2, marginBottom: 8 },
  signUpBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 20 },
  signUpBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginPrompt: { color: '#888899', fontSize: 13 },
  loginLink: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
});
