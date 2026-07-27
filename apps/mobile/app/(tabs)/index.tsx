import { ScrollView, View, Text, TouchableOpacity, TextInput, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';
import { COLORS, SERVICES, WHATSAPP_NUMBER } from '@/constants';

const PLATFORM = [
  { emoji: '🏢', title: 'Start', sub: 'Register & Set Up', stat: '7-day', color: COLORS.emerald, tab: '/services' },
  { emoji: '✅', title: 'Comply', sub: 'Tax & Filings', stat: '₹499', color: COLORS.blueLight, tab: '/services' },
  { emoji: '👥', title: 'Hire', sub: 'Verified Talent', stat: '24hr', color: COLORS.violet, tab: '/freelancers' },
  { emoji: '🏛️', title: 'Work', sub: 'Coworking Spaces', stat: '200+', color: COLORS.orange, tab: '/coworking' },
  { emoji: '🚀', title: 'Grow', sub: 'Funding & Scale', stat: '500+', color: COLORS.amber, tab: '/services' },
];

export default function HomeScreen() {
  const [search, setSearch] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#08112A', '#0F2044']} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreet}>Good morning 👋</Text>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>Fre</Text>
                <Text style={[styles.brand, { color: COLORS.blueLight }]}>Work</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push('/profile')}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search services, spaces, talent..."
              placeholderTextColor="rgba(148,163,184,0.5)"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            {[['500+', 'BUSINESSES'], ['200+', 'SPACES'], ['8', 'CITIES'], ['₹499', 'FROM']].map(([n, l], i, arr) => (
              <View key={l} style={[styles.statCell, i < arr.length - 1 && styles.statBorder]}>
                <Text style={styles.statNum}>{n}</Text>
                <Text style={styles.statLbl}>{l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Platform pillars */}
        <View style={styles.section}>
          <Text style={styles.sectionEye}>ONE PLATFORM · FIVE ESSENTIALS</Text>
          <Text style={styles.sectionTitle}>Everything your business needs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {PLATFORM.map((p) => (
              <TouchableOpacity key={p.title} style={[styles.pillarCard, { borderColor: p.color + '44' }]} onPress={() => router.push(p.tab as any)}>
                <Text style={{ fontSize: 26, marginBottom: 6 }}>{p.emoji}</Text>
                <Text style={[styles.pillarTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={styles.pillarSub}>{p.sub}</Text>
                <View style={[styles.pillarBadge, { backgroundColor: p.color + '18' }]}>
                  <Text style={[styles.pillarBadgeText, { color: p.color }]}>{p.stat}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Services */}
        <View style={styles.section}>
          <Text style={styles.sectionEye}>POPULAR SERVICES</Text>
          <Text style={styles.sectionTitle}>Most booked this week</Text>
          <View style={styles.serviceGrid}>
            {SERVICES.slice(0, 6).map((s) => (
              <TouchableOpacity key={s.title} style={[styles.serviceCard, { borderColor: s.color + '33' }]}
                onPress={() => {
                  const msg = `Hi, I'm interested in ${s.title} (${s.price}). Please help.`;
                  Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`)
                    .catch(() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`));
                }}>
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</Text>
                <Text style={styles.serviceTitle}>{s.title}</Text>
                <Text style={[styles.servicePrice, { color: s.color }]}>{s.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Why FreWork */}
        <View style={[styles.section, { backgroundColor: COLORS.navy2, borderRadius: 20, marginHorizontal: 16, marginBottom: 16, padding: 20 }]}>
          <Text style={[styles.sectionEye, { color: COLORS.blueLight }]}>WHY FREWORK</Text>
          <Text style={[styles.sectionTitle, { color: '#fff' }]}>Trusted by 500+ businesses</Text>
          {[
            { icon: '⚡', text: 'Expert CAs & lawyers — verified & accountable' },
            { icon: '💰', text: 'Transparent pricing starting ₹499' },
            { icon: '📱', text: 'WhatsApp support — response under 2 hours' },
            { icon: '🌏', text: 'Pan-India — 8 cities, fully online' },
          ].map((i) => (
            <View key={i.text} style={styles.whyRow}>
              <Text style={{ fontSize: 18 }}>{i.icon}</Text>
              <Text style={styles.whyText}>{i.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <WhatsAppFAB />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerGreet: { fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 2 },
  brandRow: { flexDirection: 'row' },
  brand: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 13, color: '#fff' },
  statsStrip: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(37,99,235,0.18)', borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(37,99,235,0.05)' },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(37,99,235,0.12)' },
  statNum: { fontSize: 16, fontWeight: '900', color: COLORS.blueLight },
  statLbl: { fontSize: 8, color: 'rgba(148,163,184,0.5)', letterSpacing: 0.8, marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionEye: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: COLORS.slate2, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  pillarCard: { width: 110, marginRight: 10, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, alignItems: 'center' },
  pillarTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  pillarSub: { fontSize: 9, color: COLORS.slate2, textAlign: 'center', marginBottom: 8 },
  pillarBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  pillarBadgeText: { fontSize: 10, fontWeight: '800' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  serviceCard: { width: '30.5%', borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, alignItems: 'center' },
  serviceTitle: { fontSize: 10, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 4 },
  servicePrice: { fontSize: 11, fontWeight: '900' },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  whyText: { fontSize: 12, color: 'rgba(203,213,225,0.8)', flex: 1, lineHeight: 18 },
});
