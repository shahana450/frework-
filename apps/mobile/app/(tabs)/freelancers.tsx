import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';
import { COLORS, FREELANCERS, WHATSAPP_NUMBER } from '@/constants';

const ROLES = ['All', 'CA / Legal', 'Developer', 'Designer', 'Consultant', 'Marketer'];

export default function FreelancersScreen() {
  const [role, setRole] = useState('All');

  const filtered = role === 'All' ? FREELANCERS : FREELANCERS.filter((f) => {
    if (role === 'CA / Legal') return f.role.includes('CA') || f.role.includes('Legal');
    if (role === 'Developer') return f.role.includes('Developer');
    if (role === 'Designer') return f.role.includes('Designer');
    if (role === 'Consultant') return f.role.includes('Consultant');
    if (role === 'Marketer') return f.role.includes('Marketer');
    return true;
  });

  const hire = (f: typeof FREELANCERS[0]) => {
    const msg = `Hi FreWork! I'd like to hire ${f.name} (${f.role}) at ${f.price}. Please connect us.`;
    Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`)
      .catch(() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>VERIFIED TALENT</Text>
          <Text style={styles.title}>Hire the right person{'\n'}in 24 hours 👥</Text>
          <Text style={styles.sub}>All professionals verified by FreWork. Pay only on acceptance.</Text>
        </View>

        {/* Role filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {ROLES.map((r) => (
            <TouchableOpacity key={r} style={[styles.filterChip, role === r && styles.filterChipActive]} onPress={() => setRole(r)}>
              <Text style={[styles.filterText, role === r && styles.filterTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Freelancer cards */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {filtered.map((f) => (
            <View key={f.name} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatarBox}>
                  <Text style={{ fontSize: 28 }}>{f.avatar}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{f.name}</Text>
                  <Text style={styles.freelancerRole}>{f.role}</Text>
                  <Text style={styles.freelancerCity}>📍 {f.city}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>{f.price}</Text>
                  <Text style={styles.rating}>⭐ {f.rating} ({f.reviews})</Text>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Verified</Text>
                  </View>
                </View>
              </View>

              <View style={styles.skills}>
                {f.skills.map((s) => (
                  <View key={s} style={styles.skillChip}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.hireBtn} onPress={() => hire(f)}>
                <Text style={styles.hireBtnText}>💬 Hire via WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Post a requirement */}
        <View style={styles.postBox}>
          <Text style={styles.postTitle}>Can't find the right person?</Text>
          <Text style={styles.postSub}>Post your requirement and we'll match you with the best talent in 24 hours.</Text>
          <TouchableOpacity style={styles.postBtn} onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent('Hi FreWork! I need to hire a professional. Here are my requirements: ')}`)}>
            <Text style={styles.postBtnText}>📝 Post a Requirement</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <WhatsAppFAB message="Hi FreWork! I'm looking to hire a professional." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: COLORS.navy2 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: COLORS.violet, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 30, marginBottom: 8 },
  sub: { fontSize: 12, color: 'rgba(148,163,184,0.7)' },
  filterScroll: { paddingVertical: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: COLORS.violet + '22', borderColor: COLORS.violet + '88' },
  filterText: { fontSize: 12, color: 'rgba(148,163,184,0.7)', fontWeight: '600' },
  filterTextActive: { color: COLORS.violet, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 12, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avatarBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  freelancerRole: { fontSize: 11, color: COLORS.violet, fontWeight: '600', marginBottom: 2 },
  freelancerCity: { fontSize: 10, color: 'rgba(148,163,184,0.6)' },
  price: { fontSize: 13, fontWeight: '900', color: COLORS.emerald, marginBottom: 2 },
  rating: { fontSize: 10, color: 'rgba(148,163,184,0.6)', marginBottom: 6 },
  verifiedBadge: { backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  verifiedText: { fontSize: 9, color: COLORS.emerald, fontWeight: '700' },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  skillChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)' },
  skillText: { fontSize: 10, color: COLORS.violet, fontWeight: '600' },
  hireBtn: { backgroundColor: '#25D366', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  hireBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  postBox: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, backgroundColor: COLORS.navy2, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', padding: 20, alignItems: 'center' },
  postTitle: { fontSize: 16, fontWeight: '900', color: '#fff', marginBottom: 6, textAlign: 'center' },
  postSub: { fontSize: 12, color: 'rgba(148,163,184,0.7)', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  postBtn: { backgroundColor: COLORS.violet, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  postBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
