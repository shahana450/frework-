import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, WEBSITE_URL, WHATSAPP_NUMBER } from '@/constants';

const COMPLIANCE_ITEMS = [
  { label: 'GST Return (Jun)', due: 'Jul 20', status: 'Due Soon', color: COLORS.amber },
  { label: 'TDS Deposit', due: 'Jul 7', status: 'Overdue', color: '#EF4444' },
  { label: 'ITR Filing', due: 'Jul 31', status: 'Upcoming', color: COLORS.blueLight },
  { label: 'ROC Annual Return', due: 'Oct 30', status: 'Upcoming', color: COLORS.emerald },
];

const MENU = [
  { emoji: '📄', label: 'My Orders', sub: 'View all service orders' },
  { emoji: '🗂️', label: 'Documents', sub: 'Store & access your docs' },
  { emoji: '📅', label: 'Compliance Calendar', sub: 'Never miss a deadline' },
  { emoji: '🏢', label: 'My Businesses', sub: 'Manage registered companies' },
  { emoji: '⭐', label: 'Reviews & Ratings', sub: 'Rate our professionals' },
  { emoji: '🌐', label: 'Visit Website', sub: 'frework.online', onPress: () => Linking.openURL(WEBSITE_URL) },
  { emoji: '💬', label: 'WhatsApp Support', sub: '+91 85908 74681', onPress: () => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`) },
];

export default function ProfileScreen() {
  const signOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <LinearGradient colors={['#0F2044', '#08112A']} style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <Text style={styles.userName}>Welcome back!</Text>
          <Text style={styles.userEmail}>auditmanagercswa@gmail.com</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>⭐ FreWork Member</Text>
          </View>
        </LinearGradient>

        {/* Compliance alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compliance Calendar 📅</Text>
          {COMPLIANCE_ITEMS.map((item) => (
            <View key={item.label} style={[styles.complianceRow, { borderLeftColor: item.color }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.complianceLabel}>{item.label}</Text>
                <Text style={styles.complianceDue}>Due: {item.due}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.color + '20' }]}>
                <Text style={[styles.statusText, { color: item.color }]}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Menu items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {MENU.map((m) => (
            <TouchableOpacity key={m.label} style={styles.menuRow} onPress={m.onPress} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{m.label}</Text>
                <Text style={styles.menuSub}>{m.sub}</Text>
              </View>
              <Text style={{ color: 'rgba(148,163,184,0.4)', fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FreWork v1.0.0 · frework.online</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(37,99,235,0.4)' },
  userName: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 4 },
  userEmail: { fontSize: 12, color: 'rgba(148,163,184,0.7)', marginBottom: 10 },
  planBadge: { backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 100 },
  planText: { color: COLORS.amber, fontSize: 11, fontWeight: '800' },
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 12 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderLeftWidth: 3, marginBottom: 8 },
  complianceLabel: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  complianceDue: { fontSize: 11, color: 'rgba(148,163,184,0.65)' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statusText: { fontSize: 10, fontWeight: '800' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  menuSub: { fontSize: 11, color: 'rgba(148,163,184,0.6)' },
  signOutBtn: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center' },
  signOutText: { color: '#EF4444', fontWeight: '800', fontSize: 14 },
  version: { textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 14 },
});
