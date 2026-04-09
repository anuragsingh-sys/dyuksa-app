import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email & password');
      return;
    }

    navigation.replace('Main');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>DYUKSA</Text>

      <TextInput placeholder="Email" style={styles.input} value={email} onChangeText={setEmail}/>
      <TextInput placeholder="Password" secureTextEntry style={styles.input} value={password} onChangeText={setPassword}/>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', padding:20, backgroundColor:'#0f172a' },
  logo: { fontSize:32, color:'#fff', textAlign:'center', marginBottom:40, fontWeight:'bold' },
  input: { backgroundColor:'#1e293b', color:'#fff', padding:12, borderRadius:8, marginBottom:15 },
  button: { backgroundColor:'#3b82f6', padding:15, borderRadius:8 },
  buttonText: { color:'#fff', textAlign:'center', fontWeight:'bold' }
});