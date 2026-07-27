import { TouchableOpacity, Text, Linking, StyleSheet } from 'react-native';
import { WHATSAPP_URL } from '@/constants';

export function WhatsAppFAB({ message = 'Hi, I need help with FreWork services.' }: { message?: string }) {
  const open = () => {
    const url = `${WHATSAPP_URL}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://wa.me/918590874681?text=${encodeURIComponent(message)}`)
    );
  };

  return (
    <TouchableOpacity style={styles.fab} onPress={open} activeOpacity={0.85}>
      <Text style={styles.icon}>💬</Text>
      <Text style={styles.label}>WhatsApp</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  icon: { fontSize: 18 },
  label: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
