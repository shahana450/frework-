import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { WhatsAppFAB } from '@/components/WhatsAppFAB';
import { COLORS, CITIES, SPACES, WHATSAPP_NUMBER } from '@/constants';

export default function CoworkingScreen() {
  const [city, setCity] = useState('All Cities');

  const filtered = city === 'All Cities' ? SPACES : SPACES.filter((s) => s.city === city);

  const enquire = (space: typeof SPACES[0]) => {
    const msg = `Hi FreWork! I'm interested in coworking at "${space.name}", ${space.city} (${space.type} · ${space.price}). Please share more details.`;
    Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`)
      .catch(() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>COWORKING SPACES</Text>
          <Text style={styles.title}>Find your perfect{'\n'}workspace 🏛️</Text>
          <Text style={styles.sub}>200+ verified spaces · 8 cities · Book via WhatsApp</Text>
        </View>

        {/* City filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CITIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.filterChip, city === c && styles.filterChipActive]} onPress={() => setCity(c)}>
              <Text style={[styles.filterText, city === c && styles.filterTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Space cards */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {filtered.map((s) => (
            <View key={s.name} style={styles.card}>
              {/* Space image placeholder */}
              <View style={styles.imagePlaceholder}>
                <Text style={{ fontSize: 40 }}>🏢</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{s.type}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spaceName}>{s.name}</Text>
                    <Text style={styles.spaceCity}>📍 {s.city}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.spacePrice}>{s.price}</Text>
                    <Text style={styles.rating}>⭐ {s.rating} ({s.seats} seats)</Text>
                  </View>
                </View>
                <View style={styles.amenities}>
                  {s.amenities.map((a) => (
                    <View key={a} style={styles.amenityChip}>
                      <Text style={styles.amenityText}>{a}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.enquireBtn} onPress={() => enquire(s)}>
                  <Text style={styles.enquireBtnText}>💬 Enquire on WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🏙️</Text>
              <Text style={styles.emptyText}>No spaces in {city} yet.</Text>
              <Text style={styles.emptySub}>Contact us and we'll find one for you.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <WhatsAppFAB message="Hi FreWork! I'm looking for a coworking space." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: COLORS.navy2 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: COLORS.orange, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 30, marginBottom: 8 },
  sub: { fontSize: 12, color: 'rgba(148,163,184,0.7)' },
  filterScroll: { paddingVertical: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: COLORS.orange + '22', borderColor: COLORS.orange + '88' },
  filterText: { fontSize: 12, color: 'rgba(148,163,184,0.7)', fontWeight: '600' },
  filterTextActive: { color: COLORS.orange, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(251,146,60,0.18)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 14, overflow: 'hidden' },
  imagePlaceholder: { height: 110, backgroundColor: 'rgba(251,146,60,0.07)', alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: COLORS.orange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  spaceName: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 3 },
  spaceCity: { fontSize: 11, color: 'rgba(148,163,184,0.65)' },
  spacePrice: { fontSize: 14, fontWeight: '900', color: COLORS.orange, marginBottom: 2 },
  rating: { fontSize: 10, color: 'rgba(148,163,184,0.6)' },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  amenityChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: 'rgba(251,146,60,0.1)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.2)' },
  amenityText: { fontSize: 10, color: COLORS.orange, fontWeight: '600' },
  enquireBtn: { backgroundColor: '#25D366', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  enquireBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptySub: { fontSize: 12, color: 'rgba(148,163,184,0.6)' },
});
