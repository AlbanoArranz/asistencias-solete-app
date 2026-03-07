import React, { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

type Ticket = { id: number; code: string; title: string; status: string; priority: string };

const API = 'http://localhost:8000/api/v1';

export default function App() {
  const [email, setEmail] = useState('tecnico1@solete.local');
  const [password, setPassword] = useState('tecnico123');
  const [token, setToken] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);

  const login = async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      await loadTickets(data.access_token);
    }
  };

  const loadTickets = async (jwt = token) => {
    if (!jwt) return;
    const res = await fetch(`${API}/tickets`, { headers: { Authorization: `Bearer ${jwt}` } });
    const data = await res.json();
    setTickets(data);
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Asistencias Solete</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
        <Button title="Entrar" onPress={login} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mis partes</Text>
        <Button title="Refrescar" onPress={() => loadTickets()} />
      </View>

      {!selected ? (
        <FlatList
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
              <Text style={styles.code}>{item.code}</Text>
              <Text>{item.title}</Text>
              <Text>{item.status} · {item.priority}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.code}>{selected.code}</Text>
          <Text>{selected.title}</Text>
          <Text>Estado: {selected.status}</Text>
          <Text>Prioridad: {selected.priority}</Text>
          <Button title="Volver" onPress={() => setSelected(null)} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  code: { fontWeight: '700' }
});
