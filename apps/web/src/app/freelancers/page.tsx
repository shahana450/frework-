"use client";

import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MapPin, CheckCircle, ArrowRight, Phone,
  Code2, Palette, TrendingUp, Calculator, GraduationCap,
  Wrench, Zap, ChefHat, Shield, Clock, Briefcase,
  Camera, Music2, Heart, Home, Scale, Megaphone,
  Languages, Dumbbell, Truck, Scissors, FlowerIcon as Flower,
  X, Loader2, User, Mail,
} from "lucide-react";
import Link from "next/link";

const CITIES = ["All Cities","Mumbai","Delhi","Bangalore","Hyderabad","Pune","Chennai","Gurgaon","Noida","Kolkata","Ahmedabad","Jaipur","Kochi","Chandigarh","Indore","Surat"];

const CATEGORIES = [
  { icon: Calculator,    label: "CA & CS",               color: "#1E40AF", bg: "rgba(30,64,175,0.08)" },
  { icon: Scale,         label: "Legal",                 color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  { icon: Code2,         label: "Tech & Dev",            color: "#0891B2", bg: "rgba(8,145,178,0.08)" },
  { icon: Palette,       label: "Design & Creative",     color: "#EC4899", bg: "rgba(236,72,153,0.08)" },
  { icon: TrendingUp,    label: "Digital Marketing",     color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { icon: Megaphone,     label: "Content & Copywriting", color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  { icon: Camera,        label: "Photography & Video",   color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { icon: GraduationCap, label: "Teaching & Tutoring",   color: "#0891B2", bg: "rgba(8,145,178,0.08)" },
  { icon: Zap,           label: "Electrician",           color: "#B45309", bg: "rgba(180,83,9,0.08)" },
  { icon: Wrench,        label: "Plumber & Carpenter",   color: "#64748B", bg: "rgba(100,116,139,0.08)" },
  { icon: ChefHat,       label: "Cook & Catering",       color: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  { icon: Shield,        label: "Security",              color: "#374151", bg: "rgba(55,65,81,0.08)" },
  { icon: Heart,         label: "Healthcare & Wellness", color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  { icon: Home,          label: "Interior Design",       color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
  { icon: Languages,     label: "Translation",           color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { icon: Music2,        label: "Music & Events",        color: "#EC4899", bg: "rgba(236,72,153,0.08)" },
  { icon: Dumbbell,      label: "Fitness & Yoga",        color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  { icon: Truck,         label: "Logistics & Driver",    color: "#374151", bg: "rgba(55,65,81,0.08)" },
  { icon: Scissors,      label: "Salon & Beauty",        color: "#BE185D", bg: "rgba(190,24,93,0.08)" },
  { icon: Flower,        label: "Vastu & Astrology",     color: "#D97706", bg: "rgba(217,119,6,0.08)" },
];

const EXPERIENCE_LEVELS = ["All Levels", "0–2 yrs (Junior)", "3–5 yrs (Mid)", "6–10 yrs (Senior)", "10+ yrs (Expert)"];

interface Freelancer {
  id: string; name: string; title: string; category: string;
  city: string; rating: number; reviews: number; rate: number; rateUnit: string;
  experience: string; expYears: number;
  skills: string[]; badge: string | null; badgeColor: string;
  available: boolean; completedJobs: number; phone: string;
  about: string;
}

const FREELANCERS: Freelancer[] = [
  // CA & CS
  { id:"1",  name:"Priya Sharma",         title:"Chartered Accountant (CA)",          category:"CA & CS",               city:"Mumbai",    rating:4.9, reviews:87,  rate:1500, rateUnit:"hr",    experience:"8 yrs",  expYears:8,  skills:["GST Filing","ITR","Tax Planning","ROC Audit","Company Reg.","TDS"],                            badge:"Top CA",        badgeColor:"#1E40AF", available:true,  completedJobs:340,  phone:"918590874681", about:"CA with 8 years experience in GST, income tax, and statutory audit for SMEs and startups across India." },
  { id:"2",  name:"Vikram CS Associates", title:"Company Secretary (CS)",              category:"CA & CS",               city:"Gurgaon",   rating:4.7, reviews:54,  rate:2500, rateUnit:"hr",    experience:"9 yrs",  expYears:9,  skills:["Company Reg.","ROC Filing","MCA","FEMA","Share Transfer","Board Meeting"],                       badge:null,            badgeColor:"",        available:false, completedJobs:98,   phone:"918590874681", about:"CS with expertise in MCA filings, annual returns, and FEMA compliance for private limited and LLP entities." },
  { id:"3",  name:"Anil CPA Services",    title:"Tax Consultant & CPA",               category:"CA & CS",               city:"Hyderabad", rating:4.8, reviews:143, rate:1200, rateUnit:"hr",    experience:"12 yrs", expYears:12, skills:["Income Tax","GST","Tax Audit","Notice Reply","MSME","Transfer Pricing"],                           badge:"Expert",        badgeColor:"#059669", available:true,  completedJobs:510,  phone:"918590874681", about:"Seasoned tax consultant handling complex tax cases, audit notices, and transfer pricing for MNCs and startups." },
  { id:"4",  name:"Meena Iyer CA",        title:"GST & Compliance Specialist",        category:"CA & CS",               city:"Chennai",   rating:4.6, reviews:61,  rate:900,  rateUnit:"hr",    experience:"6 yrs",  expYears:6,  skills:["GST Registration","GSTR-1","GSTR-3B","GSTR-9","ITC Reconciliation","E-way Bill"],                 badge:null,            badgeColor:"",        available:true,  completedJobs:220,  phone:"918590874681", about:"Dedicated GST specialist for e-commerce sellers, traders, and exporters across India." },

  // Legal
  { id:"5",  name:"Adv. Rajesh Nair",     title:"Corporate & Contract Lawyer",        category:"Legal",                 city:"Mumbai",    rating:4.8, reviews:72,  rate:3000, rateUnit:"hr",    experience:"11 yrs", expYears:11, skills:["Contract Drafting","NDA","Employment Law","Mergers","NCLT","Arbitration"],                         badge:"Senior Advocate",badgeColor:"#7C3AED", available:true,  completedJobs:180,  phone:"918590874681", about:"Corporate lawyer specialising in M&A, startup agreements, and commercial dispute resolution." },
  { id:"6",  name:"Sneha Kulkarni",        title:"IP & Trademark Lawyer",              category:"Legal",                 city:"Pune",      rating:4.7, reviews:38,  rate:2000, rateUnit:"hr",    experience:"7 yrs",  expYears:7,  skills:["Trademark Filing","Patent Search","Copyright","Design Registration","IP Litigation","Brand Audit"],  badge:null,            badgeColor:"",        available:true,  completedJobs:95,   phone:"918590874681", about:"IP lawyer helping startups and brands protect trademarks, patents, and copyrights across India and globally." },

  // Tech & Dev
  { id:"7",  name:"Rahul Verma",          title:"Full-Stack Developer",               category:"Tech & Dev",            city:"Bangalore", rating:4.8, reviews:124, rate:2000, rateUnit:"hr",    experience:"6 yrs",  expYears:6,  skills:["React","Node.js","Next.js","AWS","PostgreSQL","Docker","TypeScript"],                               badge:"Top Rated",     badgeColor:"#0891B2", available:true,  completedJobs:218,  phone:"918590874681", about:"Full-stack developer building scalable SaaS products, e-commerce platforms, and REST APIs." },
  { id:"8",  name:"Kiran Dev Studio",     title:"Mobile App Developer (Flutter)",     category:"Tech & Dev",            city:"Hyderabad", rating:4.7, reviews:89,  rate:1800, rateUnit:"hr",    experience:"5 yrs",  expYears:5,  skills:["Flutter","Dart","Firebase","iOS","Android","REST APIs","Push Notifications"],                        badge:null,            badgeColor:"",        available:true,  completedJobs:142,  phone:"918590874681", about:"Flutter developer delivering high-quality cross-platform mobile apps for startups and enterprises." },
  { id:"9",  name:"DataFlow Analytics",   title:"Data Scientist & ML Engineer",       category:"Tech & Dev",            city:"Bangalore", rating:4.9, reviews:63,  rate:3500, rateUnit:"hr",    experience:"8 yrs",  expYears:8,  skills:["Python","Machine Learning","TensorFlow","Power BI","SQL","Data Viz","NLP"],                          badge:"AI Expert",     badgeColor:"#0891B2", available:true,  completedJobs:87,   phone:"918590874681", about:"ML engineer building AI-powered dashboards, recommendation systems, and NLP tools for businesses." },
  { id:"10", name:"WebCraft Solutions",   title:"WordPress & E-commerce Developer",   category:"Tech & Dev",            city:"Delhi",     rating:4.5, reviews:212, rate:800,  rateUnit:"hr",    experience:"7 yrs",  expYears:7,  skills:["WordPress","WooCommerce","Shopify","SEO","Speed Optimisation","PHP","MySQL"],                         badge:"Popular",       badgeColor:"#D97706", available:true,  completedJobs:680,  phone:"918590874681", about:"Affordable WordPress specialist for business websites, online stores, and blog setups." },
  { id:"11", name:"Cloud Ops India",      title:"DevOps & Cloud Engineer",            category:"Tech & Dev",            city:"Pune",      rating:4.7, reviews:48,  rate:2500, rateUnit:"hr",    experience:"6 yrs",  expYears:6,  skills:["AWS","Azure","Kubernetes","CI/CD","Terraform","Linux","Docker","Ansible"],                           badge:null,            badgeColor:"",        available:false, completedJobs:74,   phone:"918590874681", about:"DevOps engineer setting up automated pipelines, cloud infrastructure, and monitoring systems." },

  // Design & Creative
  { id:"12", name:"Ananya Krishnan",      title:"UI/UX Designer",                     category:"Design & Creative",     city:"Hyderabad", rating:4.9, reviews:96,  rate:1800, rateUnit:"hr",    experience:"5 yrs",  expYears:5,  skills:["Figma","Adobe XD","Branding","Web Design","Mobile UI","Prototyping","User Research"],               badge:"Designer Pro",  badgeColor:"#EC4899", available:true,  completedJobs:175,  phone:"918590874681", about:"UI/UX designer creating user-centred mobile apps, SaaS dashboards, and brand identities." },
  { id:"13", name:"PixelCraft Studio",    title:"Graphic Designer & Brand Expert",    category:"Design & Creative",     city:"Mumbai",    rating:4.8, reviews:187, rate:1200, rateUnit:"hr",    experience:"9 yrs",  expYears:9,  skills:["Illustrator","Photoshop","Logo Design","Brochure","Packaging","Social Media Graphics","Canva"],      badge:"Top Studio",    badgeColor:"#EC4899", available:true,  completedJobs:490,  phone:"918590874681", about:"Award-winning graphic design studio specialising in brand identity, packaging, and marketing collateral." },
  { id:"14", name:"Motionworks India",    title:"Video Editor & Motion Designer",     category:"Design & Creative",     city:"Bangalore", rating:4.7, reviews:55,  rate:1500, rateUnit:"hr",    experience:"4 yrs",  expYears:4,  skills:["After Effects","Premiere Pro","Reels","YouTube","2D Animation","Explainer Videos","Color Grading"],  badge:null,            badgeColor:"",        available:true,  completedJobs:113,  phone:"918590874681", about:"Video editor and motion designer creating engaging reels, ads, explainer videos, and corporate films." },

  // Digital Marketing
  { id:"15", name:"Arjun Mehta",          title:"Digital Marketing Expert",           category:"Digital Marketing",     city:"Delhi",     rating:4.7, reviews:63,  rate:1200, rateUnit:"hr",    experience:"7 yrs",  expYears:7,  skills:["SEO","Google Ads","Meta Ads","Content Strategy","Email Marketing","Analytics","LinkedIn Ads"],        badge:null,            badgeColor:"",        available:true,  completedJobs:142,  phone:"918590874681", about:"360° digital marketer helping brands grow organically and through paid campaigns on Google and Meta." },
  { id:"16", name:"GrowthHack Labs",      title:"Performance Marketing Specialist",   category:"Digital Marketing",     city:"Bangalore", rating:4.8, reviews:91,  rate:2000, rateUnit:"hr",    experience:"6 yrs",  expYears:6,  skills:["Facebook Ads","Google Ads","CRO","Funnel Building","Klaviyo","ROAS Optimisation","A/B Testing"],    badge:"Top Marketer",  badgeColor:"#059669", available:true,  completedJobs:203,  phone:"918590874681", about:"Performance marketer scaling e-commerce and D2C brands with data-driven paid media strategies." },

  // Content & Copywriting
  { id:"17", name:"WordSmith Priya",      title:"Content Writer & SEO Copywriter",    category:"Content & Copywriting", city:"Kolkata",   rating:4.8, reviews:134, rate:500,  rateUnit:"hr",    experience:"5 yrs",  expYears:5,  skills:["Blog Writing","SEO Articles","Website Copy","Email Sequences","Social Media","Press Release"],         badge:"Top Writer",    badgeColor:"#D97706", available:true,  completedJobs:420,  phone:"918590874681", about:"SEO content writer creating high-ranking articles, product descriptions, and email campaigns for brands." },
  { id:"18", name:"TechWrite India",      title:"Technical Writer & Documentation",   category:"Content & Copywriting", city:"Pune",      rating:4.6, reviews:47,  rate:800,  rateUnit:"hr",    experience:"6 yrs",  expYears:6,  skills:["API Docs","User Manuals","SOP Writing","White Papers","Case Studies","Confluence"],                   badge:null,            badgeColor:"",        available:true,  completedJobs:88,   phone:"918590874681", about:"Technical writer creating API documentation, SOPs, and user guides for SaaS products and IT companies." },

  // Photography & Video
  { id:"19", name:"Lens & Life Studio",   title:"Wedding & Event Photographer",       category:"Photography & Video",   city:"Mumbai",    rating:4.9, reviews:310, rate:15000,rateUnit:"event", experience:"10 yrs", expYears:10, skills:["Wedding Photography","Portrait","Pre-wedding","Drone","Editing","Videography","Live Streaming"],    badge:"Top Studio",    badgeColor:"#DC2626", available:true,  completedJobs:650,  phone:"918590874681", about:"Premium wedding photographer capturing memories with cinematic storytelling and drone shots." },
  { id:"20", name:"Product Shots India",  title:"Product & E-commerce Photographer", category:"Photography & Video",   city:"Delhi",     rating:4.7, reviews:88,  rate:3000, rateUnit:"day",   experience:"5 yrs",  expYears:5,  skills:["Product Photography","White Background","360° View","Amazon/Flipkart","Food Photography","Editing"],  badge:null,            badgeColor:"",        available:true,  completedJobs:340,  phone:"918590874681", about:"E-commerce product photographer creating catalogue-ready images for Amazon, Flipkart, and D2C brands." },

  // Teaching & Tutoring
  { id:"21", name:"Deepa Nair",           title:"CBSE Maths & Science Tutor",         category:"Teaching & Tutoring",   city:"Pune",      rating:4.9, reviews:211, rate:600,  rateUnit:"hr",    experience:"10 yrs", expYears:10, skills:["Class 9–12","JEE Prep","CBSE","ICSE","Maths","Physics","Chemistry","Online Classes"],                 badge:"Expert Tutor",  badgeColor:"#D97706", available:true,  completedJobs:890,  phone:"918590874681", about:"Experienced CBSE tutor with a 95%+ student success rate in JEE Main and Board exams." },
  { id:"22", name:"EnglishPro Academy",   title:"English Language & IELTS Trainer",   category:"Teaching & Tutoring",   city:"Bangalore", rating:4.8, reviews:143, rate:800,  rateUnit:"hr",    experience:"8 yrs",  expYears:8,  skills:["Spoken English","IELTS","TOEFL","Business English","Grammar","Communication Skills","Pronunciation"],  badge:null,            badgeColor:"",        available:true,  completedJobs:470,  phone:"918590874681", about:"IELTS trainer helping students score 7+ bands with structured coaching and mock tests." },
  { id:"23", name:"CodeKids Tutor",       title:"Coding & Robotics Instructor (Kids)",category:"Teaching & Tutoring",   city:"Hyderabad", rating:4.9, reviews:78,  rate:700,  rateUnit:"hr",    experience:"4 yrs",  expYears:4,  skills:["Python for Kids","Scratch","Arduino","Robotics","Game Dev","Math+Coding"],                            badge:"Popular",       badgeColor:"#0891B2", available:true,  completedJobs:210,  phone:"918590874681", about:"Certified coding instructor teaching Python, Scratch, and robotics to children aged 6–16." },

  // Electrician
  { id:"24", name:"Suresh Electricals",   title:"Licensed Electrician",               category:"Electrician",           city:"Chennai",   rating:4.8, reviews:178, rate:400,  rateUnit:"visit", experience:"12 yrs", expYears:12, skills:["Wiring","AC Installation","Solar Panel","CCTV","DB Board","Inverter","Short Circuit Fix"],             badge:"Govt. Licensed", badgeColor:"#DC2626", available:true, completedJobs:630,  phone:"918590874681", about:"Licensed electrician handling home wiring, AC installation, solar panels, and emergency repairs." },
  { id:"25", name:"PowerFix Pro",         title:"Industrial & Commercial Electrician",category:"Electrician",           city:"Pune",      rating:4.7, reviews:92,  rate:700,  rateUnit:"visit", experience:"15 yrs", expYears:15, skills:["3-Phase Wiring","Generator","AMF Panel","Transformer","Industrial Maintenance","UPS","Safety Audit"],  badge:null,            badgeColor:"",        available:true,  completedJobs:410,  phone:"918590874681", about:"Industrial electrician for factories, warehouses, and commercial buildings with 15 years of field experience." },

  // Plumber & Carpenter
  { id:"26", name:"Ravi Plumbing Works",  title:"Plumber & Sanitation Expert",        category:"Plumber & Carpenter",   city:"Mumbai",    rating:4.6, reviews:147, rate:350,  rateUnit:"visit", experience:"15 yrs", expYears:15, skills:["Leakage Fix","Bathroom Fitting","Pipe Work","Water Tank","Drainage","Motor Repair","CPVC/PVC"],        badge:null,            badgeColor:"",        available:true,  completedJobs:560,  phone:"918590874681", about:"Experienced plumber for residential and commercial plumbing, bathroom renovation, and emergency leakage repair." },
  { id:"27", name:"WoodCraft Interiors",  title:"Carpenter & Furniture Maker",        category:"Plumber & Carpenter",   city:"Bangalore", rating:4.8, reviews:109, rate:500,  rateUnit:"day",   experience:"12 yrs", expYears:12, skills:["Modular Furniture","Wardrobe","Kitchen Cabinet","Bed Design","Polish","Door Frame","Custom Woodwork"],  badge:"Top Carpenter", badgeColor:"#B45309", available:true,  completedJobs:380,  phone:"918590874681", about:"Custom furniture carpenter specialising in modular kitchens, wardrobes, and wooden interiors for homes." },

  // Cook & Catering
  { id:"28", name:"Meena Homefoods",      title:"Home Cook & Catering",               category:"Cook & Catering",       city:"Bangalore", rating:4.9, reviews:302, rate:800,  rateUnit:"day",   experience:"8 yrs",  expYears:8,  skills:["South Indian","North Indian","Event Catering","Tiffin Service","Sweets","Biryani","Corporate Lunch"],  badge:"Popular",       badgeColor:"#BE185D", available:true,  completedJobs:1200, phone:"918590874681", about:"Professional home cook providing tiffin services, event catering, and bulk meal orders across Bangalore." },
  { id:"29", name:"Chef Arora Events",    title:"Corporate & Wedding Chef",           category:"Cook & Catering",       city:"Delhi",     rating:4.8, reviews:145, rate:5000, rateUnit:"event", experience:"14 yrs", expYears:14, skills:["Buffet Setup","Live Counter","Multi-cuisine","Hygiene Cert.","200–1000 pax","Bar & Snacks"],         badge:"Pro Chef",      badgeColor:"#BE185D", available:true,  completedJobs:430,  phone:"918590874681", about:"Certified chef managing full-service catering for corporate events, weddings, and private parties in Delhi NCR." },

  // Security
  { id:"30", name:"SecureGuard Services", title:"Security Guard & Supervisor",        category:"Security",              city:"Mumbai",    rating:4.5, reviews:67,  rate:600,  rateUnit:"day",   experience:"10 yrs", expYears:10, skills:["24/7 Guard","CCTV Monitor","Access Control","Event Security","Bouncer","First Aid","Report Writing"], badge:"Verified",      badgeColor:"#374151", available:true,  completedJobs:720,  phone:"918590874681", about:"Trained security professionals for residential societies, offices, retail stores, and event venues." },

  // Healthcare & Wellness
  { id:"31", name:"Dr. Kavita Physiotherapy",title:"Physiotherapist (Home Visit)",    category:"Healthcare & Wellness", city:"Hyderabad", rating:4.9, reviews:189, rate:800,  rateUnit:"session",experience:"9 yrs",  expYears:9,  skills:["Back Pain","Sports Injury","Stroke Rehab","Post-Surgery","Knee Pain","Dry Needling","Home Visit"],     badge:"AIIMS Trained", badgeColor:"#DC2626", available:true,  completedJobs:310,  phone:"918590874681", about:"Certified physiotherapist offering home visit sessions for back pain, sports injuries, and post-operative rehab." },
  { id:"32", name:"NutriLife Dietician",  title:"Dietician & Nutrition Coach",        category:"Healthcare & Wellness", city:"Pune",      rating:4.8, reviews:134, rate:700,  rateUnit:"session",experience:"7 yrs",  expYears:7,  skills:["Weight Loss","PCOD Diet","Diabetic Diet","Sports Nutrition","Thyroid","Pregnancy Diet","Online Consult"],badge:null,            badgeColor:"",        available:true,  completedJobs:280,  phone:"918590874681", about:"Registered dietician creating personalised diet plans for weight loss, diabetes management, and sports performance." },

  // Interior Design
  { id:"33", name:"SpaceStudio Design",   title:"Interior Designer",                  category:"Interior Design",       city:"Mumbai",    rating:4.8, reviews:76,  rate:2000, rateUnit:"hr",    experience:"8 yrs",  expYears:8,  skills:["Residential Design","Office Interiors","3D Rendering","Space Planning","Vastu","Modular Kitchen","Budget Planning"],badge:"Architect",    badgeColor:"#7C3AED", available:true,  completedJobs:140,  phone:"918590874681", about:"Interior architect transforming homes and offices with functional, aesthetic, and Vastu-compliant designs." },

  // Translation
  { id:"34", name:"LinguaIndia Services", title:"Translator & Interpreter",           category:"Translation",           city:"Kolkata",   rating:4.7, reviews:58,  rate:600,  rateUnit:"hr",    experience:"10 yrs", expYears:10, skills:["Hindi–English","Bengali–English","Legal Translation","Medical Translation","Certified Notary","Subtitling"],badge:null,           badgeColor:"",        available:true,  completedJobs:330,  phone:"918590874681", about:"Certified translator for legal, medical, and corporate documents across 8 Indian languages." },

  // Fitness & Yoga
  { id:"35", name:"YogaWithRita",         title:"Yoga Instructor & Wellness Coach",   category:"Fitness & Yoga",        city:"Bangalore", rating:4.9, reviews:241, rate:500,  rateUnit:"session",experience:"12 yrs", expYears:12, skills:["Hatha Yoga","Prenatal Yoga","Meditation","Pranayama","Stress Relief","Corporate Wellness","Online Classes"],badge:"Certified",    badgeColor:"#D97706", available:true,  completedJobs:900,  phone:"918590874681", about:"RYT-500 certified yoga teacher offering group classes, corporate wellness sessions, and prenatal yoga online." },

  // Logistics
  { id:"36", name:"FastMove Logistics",   title:"Goods Transport & Delivery Driver",  category:"Logistics & Driver",    city:"Chennai",   rating:4.5, reviews:203, rate:1200, rateUnit:"day",   experience:"8 yrs",  expYears:8,  skills:["Tempo/Van","Intra-city Delivery","E-commerce Pickup","House Shifting","LCV/HCV","Time-bound Delivery"],badge:null,           badgeColor:"",        available:true,  completedJobs:510,  phone:"918590874681", about:"Reliable transport driver for intra-city goods delivery, house shifting, and last-mile e-commerce logistics." },

  // Salon & Beauty
  { id:"37", name:"GlowUp Beauty",        title:"Home-Visit Makeup Artist",           category:"Salon & Beauty",        city:"Delhi",     rating:4.8, reviews:178, rate:3000, rateUnit:"event", experience:"7 yrs",  expYears:7,  skills:["Bridal Makeup","HD Makeup","Party Makeup","Saree Draping","Airbrush","Hair Styling","At-home Facial"],  badge:"Bridal Pro",    badgeColor:"#BE185D", available:true,  completedJobs:340,  phone:"918590874681", about:"Celebrity-trained makeup artist specialising in bridal and party looks with home-visit convenience." },

  // Music & Events
  { id:"38", name:"BeatMaster Events",    title:"DJ & Event Coordinator",             category:"Music & Events",        city:"Mumbai",    rating:4.7, reviews:96,  rate:8000, rateUnit:"event", experience:"9 yrs",  expYears:9,  skills:["DJ (EDM/Bollywood)","MC/Anchor","Sound System","LED Setup","Corporate Events","Wedding DJ","Live Streaming"], badge:null,          badgeColor:"",        available:true,  completedJobs:280,  phone:"918590874681", about:"Professional DJ and event coordinator managing music, sound, and full event production for weddings and corporate events." },

  // Vastu & Astrology
  { id:"39", name:"Pandit Vikas Joshi",   title:"Vastu Consultant & Astrologer",      category:"Vastu & Astrology",     city:"Jaipur",    rating:4.6, reviews:115, rate:2000, rateUnit:"session",experience:"20 yrs", expYears:20, skills:["Home Vastu","Office Vastu","Kundli","Numerology","Gemstone","Muhurta","Online Consult"],              badge:"Verified Pandit",badgeColor:"#D97706",available:true,  completedJobs:1500, phone:"918590874681", about:"Experienced Vastu and Jyotish consultant providing remedies for home, office, and personal life through online and in-person sessions." },
];

interface HireTarget { name: string; title: string; city: string; rate: number; rateUnit: string; }

export default function FreelancersPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [city,           setCity]           = useState("All Cities");
  const [expLevel,       setExpLevel]       = useState("All Levels");
  const [query,          setQuery]          = useState("");
  const [hireTarget,     setHireTarget]     = useState<HireTarget | null>(null);
  const [hireForm,       setHireForm]       = useState({ name: "", phone: "", email: "", message: "" });
  const [hireLoading,    setHireLoading]    = useState(false);
  const [hireDone,       setHireDone]       = useState(false);

  const filtered = useMemo(() => FREELANCERS.filter(f => {
    if (activeCategory !== "All"       && f.category !== activeCategory) return false;
    if (city           !== "All Cities" && f.city     !== city)           return false;
    if (expLevel !== "All Levels") {
      if (expLevel === "0–2 yrs (Junior)"  && f.expYears > 2)  return false;
      if (expLevel === "3–5 yrs (Mid)"     && (f.expYears < 3 || f.expYears > 5)) return false;
      if (expLevel === "6–10 yrs (Senior)" && (f.expYears < 6 || f.expYears > 10)) return false;
      if (expLevel === "10+ yrs (Expert)"  && f.expYears <= 10) return false;
    }
    const q = query.toLowerCase();
    return !q || f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)
              || f.category.toLowerCase().includes(q) || f.skills.some(s => s.toLowerCase().includes(q));
  }), [activeCategory, city, expLevel, query]);

  const submitHire = async () => {
    if (!hireTarget || !hireForm.name || !hireForm.phone) return;
    setHireLoading(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "freelancer_inquiry",
        name: hireForm.name, phone: hireForm.phone, email: hireForm.email,
        message: hireForm.message,
        meta: { freelancer: hireTarget.name, title: hireTarget.title, city: hireTarget.city, rate: hireTarget.rate },
      }),
    });
    setHireLoading(false);
    setHireDone(true);
  };

  const closeModal = () => { setHireTarget(null); setHireForm({ name:"", phone:"", email:"", message:"" }); setHireDone(false); };

  return (
    <PageLayout>
      {/* ── Hire Modal ── */}
      <AnimatePresence>
        {hireTarget && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ scale:0.95, y:16 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:16 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 relative">
              <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
              {hireDone ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Inquiry Sent!</h3>
                  <p className="text-sm text-slate-500 mb-4">Our team will connect you with <strong>{hireTarget.name}</strong> within 2 hours on WhatsApp.</p>
                  <button onClick={closeModal} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">Done</button>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <p className="text-xs font-bold text-blue-600 tracking-wider uppercase mb-1">Hiring Request</p>
                    <h3 className="text-xl font-black text-slate-900">{hireTarget.name}</h3>
                    <p className="text-sm text-slate-500">{hireTarget.title} · {hireTarget.city} · ₹{hireTarget.rate.toLocaleString("en-IN")}/{hireTarget.rateUnit}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Your Name *" value={hireForm.name}
                        onChange={e => setHireForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="tel" placeholder="Mobile Number *" value={hireForm.phone}
                        onChange={e => setHireForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"").slice(0,10) }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" placeholder="Email (optional)" value={hireForm.email}
                        onChange={e => setHireForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
                    </div>
                    <textarea rows={3} placeholder="Describe your requirement..." value={hireForm.message}
                      onChange={e => setHireForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 resize-none" />
                    <button onClick={submitHire} disabled={hireLoading || !hireForm.name || !hireForm.phone}
                      className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                      {hireLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send Hiring Request"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0F2044 0%,#1E3A8A 100%)" }} className="border-b border-blue-900">
        <div className="container py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {FREELANCERS.length}+ Verified Professionals
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Hire Verified<br />
            <span style={{ background:"linear-gradient(90deg,#60A5FA,#93C5FD)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Freelancers & Experts
            </span>
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-xl">
            CAs, lawyers, developers, designers, teachers, skilled workers & more — all verified, across 16 cities in India.
          </p>
          <div className="flex gap-2 max-w-2xl">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-12">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by skill, name, category or city..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800" />
            </div>
            <button className="h-12 px-6 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ background:"linear-gradient(135deg,#2563EB,#1246C8)" }}>
              <Search className="w-4 h-4" /> Search
            </button>
          </div>
          <div className="flex flex-wrap gap-6 mt-10">
            {[[String(FREELANCERS.length)+"+","Verified Experts"],[String(CATEGORIES.length),"Categories"],["4.8★","Avg Rating"],["Free","To Post a Job"]].map(([v,l]) => (
              <div key={l}><p className="text-xl font-black text-white">{v}</p><p className="text-blue-300 text-xs">{l}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-10">

        {/* Filters panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Filter Professionals</p>
          <div className="space-y-5">

            {/* Category */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {["All", ...CATEGORIES.map(c => c.label)].map(cat => {
                  const catDef = CATEGORIES.find(c => c.label === cat);
                  const isActive = activeCategory === cat;
                  return (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border"
                      style={isActive
                        ? { background: catDef?.color ?? "#0F172A", color:"#fff", borderColor: catDef?.color ?? "#0F172A" }
                        : { background:"#fff", color:"#475569", borderColor:"#E2E8F0" }}>
                      {catDef && <catDef.icon className="w-3 h-3" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">City</p>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <button key={c} onClick={() => setCity(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${city===c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Experience Level</p>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_LEVELS.map(e => (
                  <button key={e} onClick={() => setExpLevel(e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${expLevel===e ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 font-medium">{filtered.length} professional{filtered.length!==1?"s":""} found</p>
          <button onClick={() => { setActiveCategory("All"); setCity("All Cities"); setExpLevel("All Levels"); setQuery(""); }}
            className="text-xs text-blue-600 font-semibold hover:underline">Clear all filters</button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((f, i) => (
            <motion.div key={f.id}
              initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-[0_8px_32px_rgba(15,32,68,0.12)] hover:border-blue-200 transition-all flex flex-col"
            >
              {/* Coloured top strip */}
              <div className="h-1" style={{ background: CATEGORIES.find(c=>c.label===f.category)?.color ?? "#2563EB" }} />

              <div className="p-5 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white border border-slate-100"
                      style={{ background: CATEGORIES.find(c=>c.label===f.category)?.color ?? "#2563EB" }}>
                      {f.name[0]}
                    </div>
                    {f.available && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" title="Available now" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base">{f.name}</h3>
                      {f.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: f.badgeColor }}>{f.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{f.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" />{f.rating} ({f.reviews})
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />{f.city}
                      </span>
                    </div>
                  </div>
                </div>

                {/* About */}
                <p className="text-[12px] text-slate-500 mb-3 leading-relaxed line-clamp-2">{f.about}</p>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {f.skills.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] text-slate-600 font-medium">{s}</span>
                  ))}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.experience}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{f.completedJobs.toLocaleString()} jobs</span>
                  <span className={`flex items-center gap-1 font-semibold ${f.available ? "text-emerald-600" : "text-slate-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${f.available ? "bg-emerald-400" : "bg-slate-300"}`} />
                    {f.available ? "Available" : "Busy"}
                  </span>
                </div>

                {/* Rate + CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                  <div>
                    <p className="text-lg font-black text-slate-900">
                      ₹{f.rate.toLocaleString("en-IN")}
                      <span className="text-xs font-normal text-slate-400">/{f.rateUnit}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Starting rate</p>
                  </div>
                  <button
                    onClick={() => { setHireTarget({ name:f.name, title:f.title, city:f.city, rate:f.rate, rateUnit:f.rateUnit }); setHireDone(false); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
                    <Phone className="w-3.5 h-3.5" /> Hire Now
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500 font-medium">No professionals found for your filters.</p>
            <button onClick={() => { setActiveCategory("All"); setCity("All Cities"); setExpLevel("All Levels"); setQuery(""); }}
              className="mt-3 text-blue-600 text-sm font-semibold hover:underline">Clear filters</button>
          </div>
        )}

        {/* Join as freelancer CTA */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center max-w-2xl mx-auto">
          <h3 className="font-bold text-lg text-slate-900 mb-2">Are you a freelancer or service provider?</h3>
          <p className="text-slate-500 text-sm mb-5">Create your profile on FreWork and get hired by verified businesses across India. Free forever for early members.</p>
          <Link href="/dashboard/freelancer/submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#1246C8,#2563EB)" }}>
            Join as a Freelancer — Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
