import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Signature from 'react-native-signature-canvas';
import Constants from 'expo-constants';

type Ticket = { id: number; code: string; title: string; status: string; priority: string; technician_id?: number | null };
type TicketEvent = { id: number; event_type: string; from_status?: string; to_status?: string; note?: string; created_at: string };
type ChecklistItem = { id: number; label: string; required: boolean; done: boolean };
type Notification = { id: number; kind: string; title: string; ticket_id?: number; read: boolean; created_at: string };

const API = (Constants.expoConfig?.extra as any)?.apiUrl || 'http://localhost:8000/api/v1';

export default function App() {
  const [email, setEmail] = useState('tecnico1@solete.local');
  const [password, setPassword] = useState('tecnico123');
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('technician');
  const [loading, setLoading] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [scheduleDay, setScheduleDay] = useState<string>(new Date().toISOString().slice(0, 10));
  const [scheduleTickets, setScheduleTickets] = useState<Ticket[]>([]);
  const [assignTechId, setAssignTechId] = useState<string>('3');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const requestJson = async (url: string, init?: RequestInit, options?: { silent?: boolean }) => {
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!options?.silent) Alert.alert('Error', data?.detail || 'Error de API');
        return null;
      }
      return data;
    } catch {
      if (!options?.silent) Alert.alert('Error de red', 'No se pudo conectar con el servidor');
      return null;
    }
  };

  const login = async () => {
    setLoading(true);
    const data = await requestJson(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    if (data?.access_token) {
      setToken(data.access_token);
      const me = await requestJson(`${API}/auth/me`, { headers: { Authorization: `Bearer ${data.access_token}` } }, { silent: true });
      setRole(me?.role || 'technician');
      await loadTickets(data.access_token, statusFilter);
      await loadUnreadCount(data.access_token);
      await loadNotifications(data.access_token);
    }
    setLoading(false);
  };

  const loadTickets = async (jwt = token, filter = statusFilter) => {
    if (!jwt) return;
    const query = filter ? `?status=${encodeURIComponent(filter)}` : '';
    const data = await requestJson(`${API}/tickets${query}`, { headers: { Authorization: `Bearer ${jwt}` } }, { silent: true });
    setTickets(Array.isArray(data) ? data : []);
  };

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    if (!token) return;
    const [evData, ckData] = await Promise.all([
      requestJson(`${API}/tickets/${t.id}/events`, { headers: authHeaders }, { silent: true }),
      requestJson(`${API}/tickets/${t.id}/checklist`, { headers: authHeaders }, { silent: true }),
    ]);
    setEvents(Array.isArray(evData) ? evData : []);
    setChecklist(Array.isArray(ckData) ? ckData : []);
  };

  const changeStatus = async (nextStatus: string) => {
    if (!selected) return;
    const data = await requestJson(`${API}/tickets/${selected.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ status: nextStatus })
    });
    if (data?.id) {
      setSelected(data);
      await loadTickets(token, statusFilter);
      await loadUnreadCount(token);
      await openTicket(data);
    }
  };

  const loadNotifications = async (jwt = token) => {
    if (!jwt) return;
    const data = await requestJson(`${API}/notifications`, { headers: { Authorization: `Bearer ${jwt}` } }, { silent: true });
    setNotifications(Array.isArray(data) ? data : []);
  };

  const loadUnreadCount = async (jwt = token) => {
    if (!jwt) return;
    const data = await requestJson(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${jwt}` } }, { silent: true });
    setUnreadCount(Number(data?.unread || 0));
  };

  const markNotificationRead = async (n: Notification) => {
    if (!token) return;
    await requestJson(`${API}/notifications/${n.id}/read`, { method: 'POST', headers: authHeaders }, { silent: true });
    await loadNotifications(token);
    await loadUnreadCount(token);
    if (n.ticket_id) {
      const ticket = await requestJson(`${API}/tickets/${n.ticket_id}`, { headers: authHeaders }, { silent: true });
      if (ticket?.id) {
        setShowNotifications(false);
        await openTicket(ticket);
      }
    }
  };

  const loadSchedule = async () => {
    if (!token) return;
    const q = `?day=${encodeURIComponent(scheduleDay)}`;
    const data = await requestJson(`${API}/tickets/schedule${q}`, { headers: authHeaders }, { silent: true });
    setScheduleTickets(Array.isArray(data) ? data : []);
  };

  const reassignSelected = async () => {
    if (!selected || role === 'technician') return;
    await requestJson(`${API}/tickets/${selected.id}/assign`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ technician_id: Number(assignTechId) })
    });
    await openTicket(selected);
    await loadTickets(token, statusFilter);
  };

  const uploadPhoto = async () => {
    if (!selected || !token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permiso requerido', 'Concede acceso a galería');
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (picked.canceled || !picked.assets?.length) return;

    const a = picked.assets[0];
    const form = new FormData();
    // @ts-ignore
    form.append('file', { uri: a.uri, name: a.fileName || `photo-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' });

    const res = await fetch(`${API}/tickets/${selected.id}/attachments/upload`, { method: 'POST', headers: authHeaders, body: form });
    if (!res.ok) return Alert.alert('Error', 'No se pudo subir foto');
    Alert.alert('OK', 'Foto subida');
    await openTicket(selected);
  };

  const saveSignature = async (signatureDataUrl: string) => {
    if (!selected) return;
    await requestJson(`${API}/tickets/${selected.id}/signature`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ signer_name: 'Cliente', signer_role: 'Responsable', image_base64: signatureDataUrl })
    });
    await openTicket(selected);
  };

  const toggleChecklist = async (item: ChecklistItem) => {
    if (!selected) return;
    await requestJson(`${API}/tickets/${selected.id}/checklist/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ done: !item.done })
    });
    await openTicket(selected);
  };

  const saveCloseSummary = async () => {
    if (!selected) return;
    await requestJson(`${API}/tickets/${selected.id}/close-summary`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ work_summary: 'Trabajo realizado y validado con cliente.', customer_acceptance: true })
    });
    await openTicket(selected);
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Asistencias Solete</Text>
        <Text style={{ marginBottom: 8 }}>API: {API}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
        {loading ? <ActivityIndicator /> : <Button title="Entrar" onPress={login} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Mis partes</Text>
          <Text>Nuevas asignaciones: {unreadCount}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Notif" onPress={async () => { await loadNotifications(); setShowNotifications(!showNotifications); }} />
          <Button title="Refrescar" onPress={async () => { await loadTickets(); await loadUnreadCount(); await loadNotifications(); }} />
        </View>
      </View>

      {showNotifications && (
        <View style={styles.card}>
          <Text style={styles.subtitle}>Notificaciones</Text>
          {notifications.length === 0 && <Text>Sin notificaciones</Text>}
          {notifications.map((n) => (
            <View key={`n-${n.id}`} style={styles.eventItem}>
              <Text>{n.read ? '✅' : '🆕'} {n.title}</Text>
              <Button title={n.read ? 'Abrir' : 'Marcar leído y abrir'} onPress={() => markNotificationRead(n)} />
            </View>
          ))}
        </View>
      )}

      {!selected ? (
        <>
          <View style={styles.filterRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={statusFilter} onChangeText={setStatusFilter} placeholder="Filtro estado" />
            <Button title="Filtrar" onPress={() => loadTickets(token, statusFilter)} />
          </View>

          <Text style={styles.subtitle}>Agenda (día)</Text>
          <View style={styles.filterRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={scheduleDay} onChangeText={setScheduleDay} placeholder="YYYY-MM-DD" />
            <Button title="Cargar" onPress={loadSchedule} />
          </View>
          {scheduleTickets.map((st) => (
            <View key={`sch-${st.id}`} style={styles.eventItem}>
              <Text>{st.code} · {st.title}</Text>
              <Text>{st.status} · tech:{st.technician_id ?? '-'}</Text>
            </View>
          ))}

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
            {role !== 'technician' && (
              <View style={styles.filterRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={assignTechId} onChangeText={setAssignTechId} placeholder="ID técnico" />
                <Button title="Reasignar" onPress={reassignSelected} />
              </View>
            )}

            <Text style={styles.subtitle}>Checklist</Text>
            {checklist.map((it) => (
              <View key={it.id} style={styles.eventItem}>
                <Text>{it.done ? '✅' : '⬜'} {it.label} {it.required ? '(req)' : ''}</Text>
                <Button title={it.done ? 'Desmarcar' : 'Completar'} onPress={() => toggleChecklist(it)} />
              </View>
            ))}
            <Button title="Guardar resumen cierre" onPress={saveCloseSummary} />

            <Text style={styles.subtitle}>Firma cliente</Text>
            <View style={{ height: 180, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
              <Signature onOK={saveSignature} descriptionText="Firma aquí" clearText="Limpiar" confirmText="Guardar" />
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
