import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';
import { COLORS, SERVICES, WHATSAPP_NUMBER } from '@/constants';

export default function ServicesScreen() {
  const book = (service: typeof SERVICES[0]) => {
    const msg = `Hi FreWork! I'd like to know more about "${service.title}" (${service.price}). Please assist.`;
    Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`)
      .catch(() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ALL SERVICES</Text>
          <Text style={styles.title}>What can we help{'\n'}you with today?</Text>
          <Text style={styles.sub}>Expert CAs deliver every service. Starting from ₹499.</Text>
        </View>

        {/* Service cards */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {SERVICES.map((s) => (
            <TouchableOpacity key={s.title} style={[styles.card, { borderColor: s.color + '33' }]} onPress={() => book(s)} activeOpacity={0.8}>
              <View style={[styles.topBar, { backgroundColor: s.color }]} />
              <View style={styles.cardRow}>
                <View style={[styles.iconBox, { backgroundColor: s.color + '18' }]}>
                  <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardSub}>{s.subtitle}</Text>
                  <View style={styles.tags}>
                    {s.items.map((item) => (
                      <View key={item} style={[styles.tag, { borderColor: s.color + '44' }]}>
                        <Text style={[styles.tagText, { color: s.color }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.price, { color: s.color }]}>{s.price}</Text>
                  <View style={[styles.bookBtn, { backgroundColor: s.color }]}>
                    <Text style={styles.bookText}>Book</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Need something custom?</Text>
          <Text style={styles.bannerSub}>Chat with our CA team on WhatsApp — we'll quote in minutes.</Text>
          <TouchableOpacity style={styles.bannerBtn} onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent('Hi, I need a custom service quote.')}`)}>
            <Text style={styles.bannerBtnText}>💬 Chat Now — Free</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <WhatsAppFAB message="Hi FreWork! I need help with a service." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: COLORS.navy2 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: COLORS.blueLight, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 30, marginBottom: 8 },
  sub: { fontSize: 12, color: 'rgba(148,163,184,0.7)', lineHeight: 18 },
  card: { borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12, overflow: 'hidden' },
  topBar: { height: 3, width: '100%' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  cardSub: { fontSize: 11, color: 'rgba(148,163,184,0.65)', marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  tagText: { fontSize: 9, fontWeight: '700' },
  price: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  bookBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100 },
  bookText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  banner: { marginHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.navy2, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)', padding: 20, alignItems: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '900', color: '#fff', marginBottom: 6, textAlign: 'center' },
  bannerSub: { fontSize: 12, color: 'rgba(148,163,184,0.7)', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  bannerBtn: { backgroundColor: '#25D366', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100 },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
