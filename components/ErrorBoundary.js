import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // ── BACKEND INTEGRATION POINT ────────────────────────────────────────
    // When ready: send error to your crash reporting service
    // e.g. Sentry.captureException(error, { extra: info });
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          DYUKSA ran into an unexpected error. Your data is safe.
        </Text>

        {__DEV__ && this.state.error && (
          <ScrollView style={styles.errorBox} showsVerticalScrollIndicator={false}>
            <Text style={styles.errorMsg}>{this.state.error.toString()}</Text>
            {this.state.info?.componentStack && (
              <Text style={styles.errorStack}>{this.state.info.componentStack}</Text>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.retryBtn} onPress={this.handleReset}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#F5F5F7',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  iconText: { fontSize: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888899', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  errorBox: {
    backgroundColor: '#1A1A2E', borderRadius: 12,
    padding: 14, maxHeight: 200, width: '100%', marginBottom: 24,
  },
  errorMsg: { color: '#F87171', fontSize: 12, fontFamily: 'monospace', marginBottom: 8 },
  errorStack: { color: '#9898A6', fontSize: 10, fontFamily: 'monospace' },
  retryBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 12,
    paddingHorizontal: 36, height: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
