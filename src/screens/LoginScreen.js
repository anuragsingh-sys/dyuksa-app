import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { T } from '../constants/tokens';
import { Icons } from '../components/Icons';

/* ── small inline icons for social buttons ──────────── */

function GoogleIcon({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18A10.997 10.997 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.94 10.94 0 0 0 12 1 10.997 10.997 0 0 0 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function AppleIcon({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.28c1.28.06 2.15.75 2.9.78.97-.2 1.9-.74 2.93-.67 1.26.1 2.2.6 2.82 1.53-2.58 1.55-1.97 4.97.3 5.93-.56 1.47-1.28 2.93-2.72 4.43zM12.06 9.19c-.15-2.34 1.84-4.36 4.02-4.19.3 2.57-2.3 4.49-4.02 4.19z" fill={T.ink} />
    </Svg>
  );
}

function SSOIcon({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={T.ink2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="10" rx="2" />
      <Circle cx="12" cy="16" r="1.5" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

/* ── Field component ────────────────────────────────── */

function Field({ label, value, onChangeText, placeholder, secureTextEntry, right, autoCapitalize = 'none', keyboardType }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.ink4}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
        />
        {right}
      </View>
    </View>
  );
}

/* ── Checkbox ───────────────────────────────────────── */

function Checkbox({ checked, onToggle, label }) {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxActive]}>
        {checked && Icons.check({ color: '#fff', size: 12, sw: 3 })}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── main component ─────────────────────────────────── */

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('rohit@dyuksa.com');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [secureText, setSecureText] = useState(true);

  const handleSignIn = () => {
    navigation.replace('Main');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          {Icons.back({ color: T.ink, size: 24 })}
        </TouchableOpacity>

        {/* Logo + brand */}
        <View style={styles.logoRow}>
          {Icons.logo({ size: 40 })}
          <Text style={styles.brandName}>Dyuksa</Text>
        </View>

        {/* Header */}
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue to your workspace</Text>

        {/* Email field */}
        <Field
          label="Work email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          keyboardType="email-address"
        />

        {/* Password field */}
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry={secureText}
          right={
            <TouchableOpacity
              onPress={() => {}}
              style={styles.forgotBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot?</Text>
            </TouchableOpacity>
          }
        />

        {/* Keep me signed in */}
        <Checkbox
          checked={keepSignedIn}
          onToggle={() => setKeepSignedIn(!keepSignedIn)}
          label="Keep me signed in"
        />

        {/* Sign in button */}
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={handleSignIn}
          activeOpacity={0.8}
        >
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
            <GoogleIcon size={20} />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
            <AppleIcon size={20} />
            <Text style={styles.socialBtnText}>Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
            <SSOIcon size={20} />
            <Text style={styles.socialBtnText}>SSO</Text>
          </TouchableOpacity>
        </View>

        {/* Create account */}
        <View style={styles.createRow}>
          <Text style={styles.createLabel}>New to Dyuksa? </Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.createLink}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── styles ─────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.surface,
  },
  scroll: {
    paddingHorizontal: 24,
  },

  /* back */
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginTop: 8,
  },

  /* logo */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.3,
  },

  /* header */
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
    marginTop: 32,
  },
  subtitle: {
    fontSize: 15,
    color: T.ink3,
    marginTop: 6,
    marginBottom: 28,
  },

  /* field */
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink2,
    marginBottom: 7,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: T.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    paddingHorizontal: 14,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: T.ink,
    height: '100%',
  },
  forgotBtn: {
    paddingLeft: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.brand,
  },

  /* checkbox */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: T.brand,
    borderColor: T.brand,
  },
  checkboxLabel: {
    fontSize: 14,
    color: T.ink2,
    fontWeight: '500',
  },

  /* sign in */
  signInBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '650',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },

  /* divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: T.hairline,
  },
  dividerText: {
    fontSize: 13,
    color: T.ink4,
    fontWeight: '500',
  },

  /* social */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.ink2,
  },

  /* create account */
  createRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  createLabel: {
    fontSize: 14,
    color: T.ink3,
  },
  createLink: {
    fontSize: 14,
    fontWeight: '650',
    color: T.brand,
  },
});
