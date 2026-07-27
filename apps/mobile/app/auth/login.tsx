import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const signIn = () => {
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient colors={['#08112A', '#0F2044', '#08112A']} style={styles.container}>
      <View style={[styles.blob, { top: -100, left: -60, backgroundColor: 'rgba(37,99,235,0.25)' }]} />
      <View style={[styles.blob, { bottom: -80, right: -40, backgroundColor: 'rgba(124,58,237,0.18)' }]} />

      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>F</Text>
        </View>
        <Text style={styles.brand}>
          Fre<Text style={styles.brandBlue}>Work</Text>
        </Text>
        <Text style={styles.tagline}>India's Complete Business Platform</Text>

        <View style={styles.pills}>
          {['Register', 'Comply', 'Hire', 'Work', 'Grow'].map((t) => (
            <View key={t} style={styles.pill}>
              <Text style={styles.pillText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.stats}>
          {[['500+', 'Businesses'], ['200+', 'Spaces'], ['8', 'Cities']].map(([n, l]) => (
            <View key={l} style={styles.statItem}>
              <Text style={styles.statNum}>{n}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.googleBtn} onPress={signIn} activeOpacity={0.85}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to FreWork's{'\n'}
          <Text style={styles.link}>Terms of Service</Text> &amp; <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', overflow: 'hidden' },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    elevation: 12,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  brand: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 6 },
  brandBlue: { color: '#60A5FA' },
  tagline: { fontSize: 13, color: 'rgba(148,163,184,0.8)', marginBottom: 24, textAlign: 'center' },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: 'rgba(37,99,235,0.12)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.25)' },
  pillText: { color: '#60A5FA', fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 0, borderWidth: 1, borderColor: 'rgba(37,99,235,0.18)', borderRadius: 12, overflow: 'hidden', marginBottom: 40, backgroundColor: 'rgba(37,99,235,0.05)' },
  statItem: { paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(37,99,235,0.12)' },
  statNum: { fontSize: 18, fontWeight: '900', color: '#60A5FA' },
  statLabel: { fontSize: 9, color: 'rgba(148,163,184,0.55)', letterSpacing: 1, marginTop: 2 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, width: '100%', justifyContent: 'center',
    elevation: 6, marginBottom: 20,
  },
  googleIcon: { fontSize: 18, fontWeight: '900', color: '#2563EB' },
  googleText: { fontSize: 16, fontWeight: '700', color: '#0F2044' },
  terms: { fontSize: 11, color: 'rgba(148,163,184,0.5)', textAlign: 'center', lineHeight: 18 },
  link: { color: '#60A5FA', textDecorationLine: 'underline' },
});
