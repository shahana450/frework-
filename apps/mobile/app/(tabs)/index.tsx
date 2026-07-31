import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS, SERVICES, WHATSAPP_NUMBER } from '@/constants';

const PLATFORM = [
  { icon: '🏢', title: 'Register',  sub: 'Company Setup',    stat: '7 days',  color: '#34D399', tab: '/services' },
  { icon: '✅', title: 'Comply',    sub: 'Tax & GST',         stat: '₹499',    color: '#60A5FA', tab: '/services' },
  { icon: '👥', title: 'Hire',      sub: 'Verified Talent',   stat: '24 hrs',  color: '#A78BFA', tab: '/freelancers' },
  { icon: '🏛️', title: 'Cowork',   sub: 'Premium Spaces',    stat: '200+',    color: '#FB923C', tab: '/coworking' },
  { icon: '🚀', title: 'Grow',      sub: 'Funding & Scale',   stat: '500+',    color: '#FCD34D', tab: '/services' },
];

const STATS = [
  { num: '500+', label: 'Businesses' },
  { num: '200+', label: 'Spaces' },
  { num: '8',    label: 'Cities' },
  { num: '₹499', label: 'Starting' },
];

function openWhatsApp(msg?: string) {
  const text = msg ?? 'Hi FreWork! I need help with my business.';
  Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`)
    .catch(() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`));
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── HEADER ── */}
        <LinearGradient colors={['#060E22', '#0B1A3E']} style={s.header}>

          {/* Top bar: brand + WhatsApp + profile */}
          <View style={s.topBar}>
            <View style={s.brandGroup}>
              <View style={s.logoBox}>
                <Text style={s.logoLetter}>F</Text>
              </View>
              <View>
                <Text style={s.brandName}>Fre<Text style={{ color: '#60A5FA' }}>Work</Text></Text>
                <Text style={s.brandTag}>India's Business Platform</Text>
              </View>
            </View>

            <View style={s.topActions}>
              {/* WhatsApp CTA */}
              <TouchableOpacity style={s.waBtn} onPress={() => openWhatsApp()} activeOpacity={0.8}>
                <Text style={s.waBtnIcon}>💬</Text>
                <Text style={s.waBtnText}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Profile */}
              <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/profile' as any)}>
                <Text style={{ fontSize: 18 }}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero headline */}
          <View style={s.heroBlock}>
            <Text style={s.heroEye}>TRUSTED BY 500+ INDIAN BUSINESSES</Text>
            <Text style={s.heroH1}>Run your business{'\n'}smarter & faster</Text>
            <Text style={s.heroSub}>Company registration · GST · Accounting · Talent · Coworking</Text>

            <TouchableOpacity style={s.heroCTA} onPress={() => openWhatsApp('Hi! I want to start my business with FreWork. Please guide me.')} activeOpacity={0.85}>
              <LinearGradient colors={['#2563EB', '#1D4ED8']} style={s.heroCTAGrad}>
                <Text style={s.heroCTAIcon}>💬</Text>
                <Text style={s.heroCTAText}>Chat with an Expert — Free</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats strip */}
          <View style={s.statsRow}>
            {STATS.map((st, i) => (
              <View key={st.label} style={[s.statCell, i < STATS.length - 1 && s.statDivider]}>
                <Text style={s.statNum}>{st.num}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── PLATFORM PILLARS ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.eyebrow}>ONE PLATFORM</Text>
            <Text style={s.sectionTitle}>Everything your business needs</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, gap: 10 }}>
            {PLATFORM.map((p) => (
              <TouchableOpacity key={p.title} style={[s.pillar, { borderColor: p.color + '30' }]} onPress={() => router.push(p.tab as any)} activeOpacity={0.75}>
                <View style={[s.pillarIconBox, { backgroundColor: p.color + '15' }]}>
                  <Text style={{ fontSize: 22 }}>{p.icon}</Text>
                </View>
                <Text style={[s.pillarTitle, { color: p.color }]}>{p.title}</Text>
                <Text style={s.pillarSub}>{p.sub}</Text>
                <View style={[s.pillarBadge, { backgroundColor: p.color + '15' }]}>
                  <Text style={[s.pillarBadgeTxt, { color: p.color }]}>{p.stat}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── POPULAR SERVICES ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.eyebrow}>MOST POPULAR</Text>
            <Text style={s.sectionTitle}>Services booked this week</Text>
          </View>
          <View style={s.serviceGrid}>
            {SERVICES.slice(0, 6).map((sv) => (
              <TouchableOpacity key={sv.title} style={[s.serviceCard, { borderColor: sv.color + '28' }]}
                onPress={() => openWhatsApp(`Hi, I'm interested in ${sv.title} (${sv.price}). Please assist.`)}
                activeOpacity={0.75}>
                <View style={[s.serviceIconBox, { backgroundColor: sv.color + '12' }]}>
                  <Text style={{ fontSize: 24 }}>{sv.emoji}</Text>
                </View>
                <Text style={s.serviceTitle}>{sv.title}</Text>
                <Text style={[s.servicePrice, { color: sv.color }]}>{sv.price}</Text>
                <Text style={s.serviceCTA}>Book via WhatsApp →</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── WHY FREWORK ── */}
        <View style={s.whyCard}>
          <Text style={s.eyebrow}>WHY FREWORK</Text>
          <Text style={[s.sectionTitle, { color: '#fff', marginBottom: 16 }]}>Built for Indian businesses</Text>
          {[
            { icon: '⚡', title: 'Expert Professionals', desc: 'Verified CAs, lawyers & consultants' },
            { icon: '💰', title: 'Transparent Pricing',  desc: 'No hidden fees, starting ₹499' },
            { icon: '💬', title: '2-Hour WhatsApp Reply', desc: 'Real humans, not bots' },
            { icon: '🌏', title: 'Pan-India Coverage',   desc: '8 cities, 100% online service' },
          ].map((w, i, arr) => (
            <View key={w.title} style={[s.whyRow, i < arr.length - 1 && s.whyBorder]}>
              <View style={s.whyIconBox}>
                <Text style={{ fontSize: 20 }}>{w.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.whyTitle}>{w.title}</Text>
                <Text style={s.whyDesc}>{w.desc}</Text>
              </View>
            </View>
          ))}

          {/* WhatsApp bottom CTA */}
          <TouchableOpacity style={s.whyWA} onPress={() => openWhatsApp()} activeOpacity={0.85}>
            <Text style={s.whyWAText}>💬  Chat with us on WhatsApp</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07101F' },

  // Header
  header: { paddingBottom: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontSize: 18, fontWeight: '900' },
  brandName: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  brandTag: { fontSize: 9, color: 'rgba(148,163,184,0.55)', letterSpacing: 0.3, marginTop: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#25D366', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  waBtnIcon: { fontSize: 13 },
  waBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  avatarBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroBlock: { paddingHorizontal: 16, marginBottom: 20 },
  heroEye: { fontSize: 9, fontWeight: '800', color: '#60A5FA', letterSpacing: 1.5, marginBottom: 8 },
  heroH1: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 36, marginBottom: 8 },
  heroSub: { fontSize: 12, color: 'rgba(148,163,184,0.65)', lineHeight: 18, marginBottom: 18 },
  heroCTA: { borderRadius: 14, overflow: 'hidden' },
  heroCTAGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20 },
  heroCTAIcon: { fontSize: 16 },
  heroCTAText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)', backgroundColor: 'rgba(37,99,235,0.06)', overflow: 'hidden' },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  statDivider: { borderRightWidth: 1, borderRightColor: 'rgba(37,99,235,0.15)' },
  statNum: { fontSize: 15, fontWeight: '900', color: '#60A5FA' },
  statLabel: { fontSize: 8, color: 'rgba(148,163,184,0.5)', letterSpacing: 0.5, marginTop: 2 },

  // Section
  section: { paddingTop: 24, paddingBottom: 4 },
  sectionHead: { paddingHorizontal: 16, marginBottom: 14 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: 'rgba(148,163,184,0.45)', letterSpacing: 2, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#fff' },

  // Pillars
  pillar: { width: 108, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, alignItems: 'center', gap: 4 },
  pillarIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pillarTitle: { fontSize: 13, fontWeight: '900' },
  pillarSub: { fontSize: 9, color: 'rgba(148,163,184,0.5)', textAlign: 'center' },
  pillarBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  pillarBadgeTxt: { fontSize: 10, fontWeight: '800' },

  // Services
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  serviceCard: { width: '47%', borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14 },
  serviceIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  serviceTitle: { fontSize: 12, fontWeight: '800', color: '#fff', marginBottom: 4, lineHeight: 16 },
  servicePrice: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  serviceCTA: { fontSize: 10, color: 'rgba(148,163,184,0.45)', fontWeight: '600' },

  // Why FreWork
  whyCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 20, backgroundColor: '#0D1E42', borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)', padding: 20 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  whyBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  whyIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  whyTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 2 },
  whyDesc: { fontSize: 11, color: 'rgba(148,163,184,0.6)', lineHeight: 16 },
  whyWA: { marginTop: 16, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  whyWAText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
