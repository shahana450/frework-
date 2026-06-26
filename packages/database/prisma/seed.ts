import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding WorkSphere database...");

  // ── Categories ──────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: "software" }, update: {}, create: { name: "Software Development", slug: "software", icon: "Code2", color: "#3B82F6" } }),
    prisma.category.upsert({ where: { slug: "ai-ml" }, update: {}, create: { name: "AI & Machine Learning", slug: "ai-ml", icon: "Brain", color: "#8B5CF6" } }),
    prisma.category.upsert({ where: { slug: "design" }, update: {}, create: { name: "Graphic Design", slug: "design", icon: "Palette", color: "#EC4899" } }),
    prisma.category.upsert({ where: { slug: "marketing" }, update: {}, create: { name: "Digital Marketing", slug: "marketing", icon: "Megaphone", color: "#F97316" } }),
    prisma.category.upsert({ where: { slug: "accounting" }, update: {}, create: { name: "Accounting & Finance", slug: "accounting", icon: "Calculator", color: "#10B981" } }),
    prisma.category.upsert({ where: { slug: "legal" }, update: {}, create: { name: "Legal Services", slug: "legal", icon: "Scale", color: "#F59E0B" } }),
    prisma.category.upsert({ where: { slug: "writing" }, update: {}, create: { name: "Writing & Content", slug: "writing", icon: "PenLine", color: "#6366F1" } }),
    prisma.category.upsert({ where: { slug: "video" }, update: {}, create: { name: "Video & Animation", slug: "video", icon: "Video", color: "#14B8A6" } }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // ── Skills ──────────────────────────────────────────────────
  const skills = await Promise.all([
    prisma.skill.upsert({ where: { slug: "react" }, update: {}, create: { name: "React", slug: "react", categoryId: categories[0].id } }),
    prisma.skill.upsert({ where: { slug: "nodejs" }, update: {}, create: { name: "Node.js", slug: "nodejs", categoryId: categories[0].id } }),
    prisma.skill.upsert({ where: { slug: "python" }, update: {}, create: { name: "Python", slug: "python", categoryId: categories[0].id } }),
    prisma.skill.upsert({ where: { slug: "typescript" }, update: {}, create: { name: "TypeScript", slug: "typescript", categoryId: categories[0].id } }),
    prisma.skill.upsert({ where: { slug: "pytorch" }, update: {}, create: { name: "PyTorch", slug: "pytorch", categoryId: categories[1].id } }),
    prisma.skill.upsert({ where: { slug: "figma" }, update: {}, create: { name: "Figma", slug: "figma", categoryId: categories[2].id } }),
    prisma.skill.upsert({ where: { slug: "seo" }, update: {}, create: { name: "SEO", slug: "seo", categoryId: categories[3].id } }),
    prisma.skill.upsert({ where: { slug: "ind-as" }, update: {}, create: { name: "IND AS", slug: "ind-as", categoryId: categories[4].id } }),
    prisma.skill.upsert({ where: { slug: "gst" }, update: {}, create: { name: "GST", slug: "gst", categoryId: categories[4].id } }),
    prisma.skill.upsert({ where: { slug: "contract-law" }, update: {}, create: { name: "Contract Law", slug: "contract-law", categoryId: categories[5].id } }),
  ]);

  console.log(`✅ Created ${skills.length} skills`);

  // ── Admin User ───────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@worksphere.global" },
    update: {},
    create: {
      email: "admin@worksphere.global",
      name: "WorkSphere Admin",
      username: "admin",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // ── Sample Freelancer ────────────────────────────────────────
  const freelancerPassword = await bcrypt.hash("Test@123456", 12);
  const freelancer = await prisma.user.upsert({
    where: { email: "sarah.chen@example.com" },
    update: {},
    create: {
      email: "sarah.chen@example.com",
      name: "Sarah Chen",
      username: "sarah_chen",
      passwordHash: freelancerPassword,
      role: UserRole.FREELANCER,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      bio: "Full-stack developer with 8 years of experience. Specializing in React, Node.js, and AI integrations.",
      freelancerProfile: {
        create: {
          title: "Full-Stack Developer & AI Specialist",
          hourlyRate: 120,
          monthlyRate: 12000,
          availability: "AVAILABLE",
          experienceYears: 8,
          totalProjects: 248,
          successRate: 98.5,
          skills: {
            create: [
              { skillId: skills[0].id, level: "EXPERT", yearsExp: 6 },
              { skillId: skills[1].id, level: "EXPERT", yearsExp: 7 },
              { skillId: skills[2].id, level: "ADVANCED", yearsExp: 5 },
              { skillId: skills[3].id, level: "EXPERT", yearsExp: 4 },
            ],
          },
          languages: {
            create: [
              { language: "English", proficiency: "NATIVE" },
              { language: "Mandarin", proficiency: "PROFESSIONAL" },
            ],
          },
          education: {
            create: [{
              institution: "Stanford University",
              degree: "BS Computer Science",
              startYear: 2012,
              endYear: 2016,
            }],
          },
        },
      },
    },
  });

  // ── Sample Client ─────────────────────────────────────────────
  const clientPassword = await bcrypt.hash("Test@123456", 12);
  const client = await prisma.user.upsert({
    where: { email: "michael.torres@example.com" },
    update: {},
    create: {
      email: "michael.torres@example.com",
      name: "Michael Torres",
      username: "michael_torres",
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      clientProfile: {
        create: {
          companyName: "NovaTech Solutions",
          companySize: "10-50",
          industry: "Technology",
          totalSpent: 125000,
          totalHires: 23,
        },
      },
    },
  });

  // ── Sample Project ──────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { slug: "build-ai-saas-platform" },
    update: {},
    create: {
      clientId: client.id,
      categoryId: categories[0].id,
      title: "Build an AI-powered SaaS Platform",
      slug: "build-ai-saas-platform",
      description: "Looking for an experienced full-stack developer to build a SaaS platform with AI integration. Must have strong experience with React, Node.js, PostgreSQL, and OpenAI API.",
      type: "FIXED",
      status: "OPEN",
      budget: 15000,
      currency: "USD",
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      experienceLevel: "EXPERT",
      locationType: "REMOTE",
      skills: {
        create: [
          { skillId: skills[0].id },
          { skillId: skills[1].id },
          { skillId: skills[2].id },
        ],
      },
    },
  });

  // ── Sample Coworking Space ───────────────────────────────────
  const space = await prisma.coworkingSpace.upsert({
    where: { slug: "the-hub-bandra" },
    update: {},
    create: {
      ownerId: admin.id,
      name: "The Hub Bandra",
      slug: "the-hub-bandra",
      description: "Mumbai's premier coworking space in the heart of Bandra. 120 seats, premium amenities, 24/7 access.",
      addressLine1: "13th Road, Khar West",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400052",
      latitude: 19.0728,
      longitude: 72.8360,
      amenities: ["High-Speed WiFi", "Coffee & Tea", "Meeting Rooms", "Standing Desks", "Lockers", "Printer", "Reception"],
      totalSeats: 120,
      availableSeats: 45,
      rating: 4.9,
      reviewCount: 342,
      isVerified: true,
      isFeatured: true,
      workspaces: {
        create: [
          { name: "Hot Desk Area", type: "HOT_DESK", capacity: 60, pricePerDay: 599, pricePerMonth: 8999, currency: "INR", isAvailable: true },
          { name: "Dedicated Desk", type: "DEDICATED_DESK", capacity: 30, pricePerDay: 999, pricePerMonth: 14999, currency: "INR", isAvailable: true },
          { name: "Conference Room A", type: "MEETING_ROOM", capacity: 10, pricePerHour: 999, currency: "INR", isAvailable: true },
          { name: "Private Cabin 1", type: "PRIVATE_CABIN", capacity: 6, pricePerMonth: 49999, currency: "INR", isAvailable: true },
        ],
      },
    },
  });

  // ── Wallets ──────────────────────────────────────────────────
  await Promise.all([
    prisma.wallet.upsert({ where: { userId: freelancer.id }, update: {}, create: { userId: freelancer.id, balance: 5250, currency: "USD" } }),
    prisma.wallet.upsert({ where: { userId: client.id }, update: {}, create: { userId: client.id, balance: 25000, currency: "USD" } }),
    prisma.wallet.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id, balance: 0, currency: "USD" } }),
  ]);

  // ── Subscriptions ─────────────────────────────────────────────
  await prisma.subscription.upsert({
    where: { userId: freelancer.id },
    update: {},
    create: {
      userId: freelancer.id,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Created sample users, projects, and coworking spaces");
  console.log("\n📋 Seed Credentials:");
  console.log("  Admin:      admin@worksphere.global / Admin@123456");
  console.log("  Freelancer: sarah.chen@example.com / Test@123456");
  console.log("  Client:     michael.torres@example.com / Test@123456");
  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
