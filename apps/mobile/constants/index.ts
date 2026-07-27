export const WHATSAPP_NUMBER = '918590874681';
export const WHATSAPP_URL = `whatsapp://send?phone=${WHATSAPP_NUMBER}`;
export const WEBSITE_URL = 'https://frework.online';
export const SUPPORT_EMAIL = 'auditmanagercswa@gmail.com';

export const COLORS = {
  navy: '#08112A',
  navy2: '#0F2044',
  blue: '#2563EB',
  blueLight: '#60A5FA',
  violet: '#A78BFA',
  emerald: '#34D399',
  amber: '#FCD34D',
  orange: '#FB923C',
  slate: 'rgba(148,163,184,0.85)',
  slate2: 'rgba(148,163,184,0.55)',
  border: 'rgba(255,255,255,0.09)',
};

export const SERVICES = [
  {
    emoji: '🏢',
    title: 'Company Registration',
    subtitle: 'Start in 7 days',
    price: '₹2,999',
    color: COLORS.emerald,
    href: 'company-registration',
    items: ['Private Limited', 'LLP', 'OPC', 'Partnership'],
  },
  {
    emoji: '✅',
    title: 'GST Registration',
    subtitle: 'Get GSTIN fast',
    price: '₹499',
    color: COLORS.blueLight,
    href: 'gst-registration',
    items: ['New Registration', 'Amendment', 'Cancellation'],
  },
  {
    emoji: '📋',
    title: 'GST Filing',
    subtitle: 'Monthly / Quarterly',
    price: '₹799/mo',
    color: COLORS.blue,
    href: 'gst-filing',
    items: ['GSTR-1', 'GSTR-3B', 'GSTR-9 Annual'],
  },
  {
    emoji: '💼',
    title: 'Income Tax (ITR)',
    subtitle: 'All ITR forms',
    price: '₹999',
    color: COLORS.amber,
    href: 'itr-filing',
    items: ['ITR-1 Salary', 'ITR-3 Business', 'ITR-4 Presumptive'],
  },
  {
    emoji: '📊',
    title: 'Virtual Accountant',
    subtitle: 'Monthly bookkeeping',
    price: '₹1,499/mo',
    color: COLORS.emerald,
    href: 'virtual-accountant',
    items: ['Ledger Management', 'P&L Statement', 'Balance Sheet'],
  },
  {
    emoji: '🚀',
    title: 'Pitch Deck & DPR',
    subtitle: 'Investor-ready',
    price: '₹4,999',
    color: COLORS.orange,
    href: 'pitch-deck',
    items: ['Pitch Deck (10 slides)', 'Detailed Project Report', 'Business Plan'],
  },
  {
    emoji: '🏛️',
    title: 'ROC / MCA Filing',
    subtitle: 'Stay compliant',
    price: '₹1,999',
    color: COLORS.violet,
    href: 'roc-filing',
    items: ['Annual Returns', 'Director KYC', 'Form ADT-1'],
  },
  {
    emoji: '🎓',
    title: 'Business Training',
    subtitle: 'Online courses',
    price: '₹2,999',
    color: COLORS.blue,
    href: 'training',
    items: ['GST Mastery', 'Company Law', 'Startup Finance'],
  },
];

export const CITIES = [
  'All Cities', 'Mumbai', 'Bangalore', 'Delhi NCR',
  'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad',
];

export const SPACES = [
  { name: 'WeHub Koramangala', city: 'Bangalore', type: 'Hot Desk', price: '₹350/day', rating: 4.8, seats: 40, amenities: ['WiFi', 'Printer', 'Coffee', 'AC'] },
  { name: 'Innov8 Andheri', city: 'Mumbai', type: 'Private Cabin', price: '₹8,000/mo', rating: 4.7, seats: 6, amenities: ['WiFi', '24/7', 'Meeting Room', 'Pantry'] },
  { name: 'Awfis Cyber City', city: 'Hyderabad', type: 'Dedicated Desk', price: '₹5,500/mo', rating: 4.6, seats: 20, amenities: ['WiFi', 'Locker', 'Cafeteria', 'Parking'] },
  { name: 'The Hive Connaught', city: 'Delhi NCR', type: 'Hot Desk', price: '₹450/day', rating: 4.9, seats: 60, amenities: ['WiFi', 'Reception', 'Events', 'Rooftop'] },
  { name: 'StartupGo Kharadi', city: 'Pune', type: 'Private Cabin', price: '₹7,000/mo', rating: 4.5, seats: 4, amenities: ['WiFi', 'AC', 'Coffee', 'Parking'] },
  { name: 'Workafella T.Nagar', city: 'Chennai', type: 'Dedicated Desk', price: '₹4,500/mo', rating: 4.7, seats: 15, amenities: ['WiFi', '24/7', 'Meeting Room', 'AC'] },
];

export const FREELANCERS = [
  { name: 'Arjun Mehta', role: 'Chartered Accountant', city: 'Mumbai', rating: 4.9, reviews: 87, price: '₹500/hr', skills: ['GST', 'ITR', 'Audit', 'ROC'], avatar: '👨‍💼' },
  { name: 'Priya Sharma', role: 'Full Stack Developer', city: 'Bangalore', rating: 4.8, reviews: 63, price: '₹800/hr', skills: ['React', 'Node.js', 'Next.js', 'MongoDB'], avatar: '👩‍💻' },
  { name: 'Rahul Gupta', role: 'Business Consultant', city: 'Delhi NCR', rating: 4.7, reviews: 42, price: '₹1,200/hr', skills: ['Pitch Deck', 'DPR', 'Funding', 'Strategy'], avatar: '👨‍🔬' },
  { name: 'Sneha Nair', role: 'UI/UX Designer', city: 'Hyderabad', rating: 4.9, reviews: 55, price: '₹650/hr', skills: ['Figma', 'Branding', 'Mobile UI', 'Web Design'], avatar: '👩‍🎨' },
  { name: 'Vikram Joshi', role: 'Legal Advisor', city: 'Pune', rating: 4.6, reviews: 38, price: '₹900/hr', skills: ['Company Law', 'Contracts', 'IPR', 'FEMA'], avatar: '👨‍⚖️' },
  { name: 'Anjali Reddy', role: 'Digital Marketer', city: 'Chennai', rating: 4.8, reviews: 71, price: '₹400/hr', skills: ['SEO', 'Google Ads', 'Social Media', 'Content'], avatar: '👩‍💼' },
];
