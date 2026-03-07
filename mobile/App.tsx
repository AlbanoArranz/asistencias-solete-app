import React, { useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Signature from 'react-native-signature-canvas';

type Ticket = { id: number; code: string; title: string; status: string; priority: string };
type TicketEvent = { id: number; event_type: string; from_status?: string; to_status?: string; note?: string; created_at: string };
const API = 'http://localhost:8000/api/v1';

export default function App() {
  const [email, setEmail] = useState('tecnico1@solete.local');
  const [password, setPassword] = useState('tecnico123');
  const [token, setToken] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [events, setEvents] = useState<TicketEvent[]>([]);

  const login = async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      await loadTickets(data.access_token, statusFilter);
    }
  };

  const loadTickets = async (jwt = token, filter = statusFilter) => {
    if (!jwt) return;
    const query = filter ? `?status=${encodeURIComponent(filter)}` : '';
    const res = await fetch(`${API}/tickets${query}`, { headers: { Authorization: `Bearer ${jwt}` } });
    const data = await res.json();
    setTickets(Array.isArray(data) ? data : []);
  };

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    if (!token) return;
    const res = await fetch(`${API}/tickets/${t.id}/events`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setEvents(Array.isArray(data) ? data : []);
  };

  const changeStatus = async (nextStatus: string) => {
    if (!token || !selected) return;
    const res = await fetch(`${API}/tickets/${selected.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();
    if (data?.id) {
      setSelected(data);
      await loadTickets(token, statusFilter);
      await openTicket(data);
    } else {
      Alert.alert('Error', data?.detail || 'No se pudo cambiar estado');
    }
  };

  const uploadPhoto = async () => {
    if (!token || !selected) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Concede acceso a galería.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0];
    const uri = asset.uri;
    const filename = asset.fileName || `photo-${Date.now()}.jpg`;
    const mime = asset.mimeType || 'image/jpeg';

    const form = new FormData();
    // @ts-ignore
    form.append('file', { uri, name: filename, type: mime });

    const res = await fetch(`${API}/tickets/${selected.id}/attachments/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      Alert.alert('Error upload', e?.detail || 'No se pudo subir foto');
      return;
    }
    Alert.alert('OK', 'Foto subida');
    await openTicket(selected);
  };

  const saveSignature = async (signatureDataUrl: string) => {
    if (!token || !selected) return;
    const res = await fetch(`${API}/tickets/${selected.id}/signature`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ signer_name: 'Cliente', signer_role: 'Responsable', image_base64: signatureDataUrl })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      Alert.alert('Error firma', e?.detail || 'No se pudo guardar firma');
      return;
    }
    Alert.alert('OK', 'Firma guardada');
    await openTicket(selected);
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
        <>
          <View style={styles.filterRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={statusFilter} onChangeText={setStatusFilter} placeholder="Filtro estado" />
            <Button title="Filtrar" onPress={() => loadTickets(token, statusFilter)} />
          </View>
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => openTicket(item)}>
                <Text style={styles.code}>{item.code}</Text>
                <Text>{item.title}</Text>
                <Text>{item.status} · {item.priority}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.card}>
            <Text style={styles.code}>{selected.code}</Text>
            <Text>{selected.title}</Text>
            <Text>Estado: {selected.status}</Text>
            <Text>Prioridad: {selected.priority}</Text>

            <View style={styles.actionsRow}>
              <Button title="En progreso" onPress={() => changeStatus('in_progress')} />
              <Button title="Resuelto" onPress={() => changeStatus('resolved')} />
              <Button title="Cerrar" onPress={() => changeStatus('closed')} />
            </View>
            <View style={styles.actionsRow}>
              <Button title="Subir foto" onPress={uploadPhoto} />
            </View>

            <Text style={styles.subtitle}>Firma cliente</Text>
            <View style={{ height: 180, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
              <Signature onOK={saveSignature} descriptionText="Firma aquí" clearText="Limpiar" confirmText="Guardar" webStyle={`.m-signature-pad--footer {display:flex;}`}/>
            </View>

            <Text style={styles.subtitle}>Timeline</Text>
            {events.map((ev) => (
              <View key={ev.id} style={styles.eventItem}>
                <Text style={{ fontWeight: '700' }}>{ev.event_type}</Text>
                <Text>{ev.from_status || '-'} → {ev.to_status || '-'}</Text>
                <Text>{ev.note || ''}</Text>
              </View>
            ))}

            <Button title="Volver" onPress={() => setSelected(null)} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 10, marginBottom: 6, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  code: { fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginVertical: 8 },
  eventItem: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 6 }
});
