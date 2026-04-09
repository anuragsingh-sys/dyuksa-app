import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.card}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>D</Text>
            </View>
          </View>

          <Text style={styles.title}>Welcome To DYUKSA</Text>
          <Text style={styles.subtitle}>Sign in to your account to continue</Text>

          <View style={[styles.inputWrap, emailFocused && styles.inputFocused]}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#AAAABC"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={[styles.inputWrap, passFocused && styles.inputFocused]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor="#AAAABC"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
              <Text>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInBtn} onPress={handleLogin}>
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpPrompt}>Don't have an account? </Text>
            <TouchableOpacity>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  logoRow: { alignItems: 'center', marginBottom: 20 },
  logoBox: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' },
  logoLetter: { color: '#4ECDC4', fontSize: 22, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#888899', textAlign: 'center', marginBottom: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F5', borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 14, marginBottom: 12, height: 50 },
  inputFocused: { borderColor: '#4ECDC4', backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 15, color: '#1A1A2E' },
  forgotRow: { alignItems: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#888899', fontSize: 13 },
  signInBtn: { backgroundColor: '#1A1A2E', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  signInText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center' },
  signUpPrompt: { color: '#888899', fontSize: 13 },
  signUpLink: { color: '#1A1A2E', fontSize: 13, fontWeight: '700' },
});
