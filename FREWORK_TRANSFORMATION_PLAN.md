# FreWork — Transformation Plan
## "The Operating System for Indian Businesses"
### Brand Promise: Start, Run and Grow Your Business — All in One Place.

---

## PART 1: CODEBASE AUDIT FINDINGS

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Radix UI, Framer Motion |
| Backend | NestJS (apps/api), Supabase direct client |
| Database | PostgreSQL via Prisma (1432-line schema) + Supabase simple tables |
| Auth | Supabase Auth + NextAuth v5 beta (installed, not configured) |
| Payments | Razorpay (webhook in apps/api) |
| Deployment | Vercel (apps/web) — project frework-api, domain frework.online |
| Monorepo | Turborepo |

### Current Routes (50+)
- Homepage: `/` (horizontal scroll — BEING REPLACED)
- Services: `/services/compliance`, `/services/dpr`, `/services/pitch-decks`, `/services/restructuring`, `/services/training`
- Marketplace: `/coworking`, `/freelancers`, `/jobs`, `/startups`
- User: `/login`, `/register`, `/dashboard`, `/dashboard/*`
- Info: `/about`, `/contact`, `/pricing`, `/blog`, `/community`
- Admin: `/admin` (security issue — hardcoded password)
- Landing: `/lp` (WhatsApp lead campaign page)

### Supabase Tables (Simple)
- `fw_leads` — WhatsApp/form leads
- `fw_users` — registered users
- `fw_enquiries` — service enquiries
- `fw_workspaces` — coworking listings
- `fw_freelancers` — freelancer profiles
- `fw_services` — service listings
- `fw_startups` — startup profiles
- `fw_subscriptions` — paid plans

### Prisma Schema (PostgreSQL — 25+ tables)
users, freelancer_profiles, coworking_spaces, projects, contracts, payments, messages, notifications, reviews, skills, portfolios, and more.

---

## PART 2: CRITICAL ISSUES FOUND

### 🔴 SECURITY (Fix immediately)
1. **Hardcoded admin password** — `apps/web/src/app/admin/page.tsx` line 63: `const ADMIN_PASS = "frework@admin2024"` — visible in source. Must be replaced with env var.
2. **No middleware.ts** — zero route-level auth protection. Any URL is publicly accessible.
3. **NextAuth installed but unconfigured** — creates a false sense of security.

### 🟡 DATA INTEGRITY (Fixed in previous session)
- All fake directory data removed from `/coworking`, `/freelancers`, `/jobs`
- All fake metrics removed from `/lp` and homepage
- "Launching Soon" honest states added

### 🟡 TECHNICAL DEBT
- Two parallel database systems (Supabase direct + Prisma) — confusing, increases maintenance
- BOM character bug in Vercel env vars (fixed with `.replace(/^﻿/, "")`)
- No sitemap.xml or robots.txt
- Metadata describes old product positioning

---

## PART 3: TRANSFORMATION VISION

### The Operating System for Indian Businesses

```
┌─────────────────────────────────────────────────────────────────┐
│  FreWork Business Dashboard                                     │
│  "One place to start, run and grow your business"              │
├─────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  START  │  COMPLY  │ FINANCE  │  FIND    │   GROW   │ LAUNCH   │
│         │          │          │  PEOPLE  │          │          │
│ Company │ Income   │Invoicing │Freelancer│   DPR    │ Startup  │
│ Reg     │ Tax      │ Payroll  │   CA     │ Pitch    │ Listing  │
│ GST Reg │ GST      │Bookkeep- │   CS     │ Deck     │Investor  │
│ PAN     │ ROC      │  ing     │  Tech    │Business  │ Connect  │
│ MSME    │ Accounts │ Banking  │ Design   │  Plan    │Funding   │
└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### Customer Journey
```
Business Idea
     ↓
[START] Register company (MCA/Govt portal via expert)
     ↓
[COMPLY] Get GST, PAN, MSME, shop license
     ↓
[FINANCE] Set up invoicing + bookkeeping
     ↓
[FIND PROFESSIONALS] Hire CA, developer, designer
     ↓
[WORKSPACE] Book coworking or office space
     ↓
[GROW] Business plan, DPR, pitch deck
     ↓
[LAUNCH] Raise funding, get investor visibility
     ↓
[DASHBOARD] Track all services, compliance calendar, renewals
```

---

## PART 4: IMPLEMENTATION PHASES

### PHASE 1 — Foundation (Current)
**Goal:** Transform the product's identity, fix security, lay honest groundwork.

1. ✅ Codebase audit
2. ✅ Remove fake data (coworking, freelancers, jobs)
3. ✅ Remove fake metrics (500+ clients, 4.9 stars, 50 cities)
4. ✅ Add Beta badges and honest "Launching Soon" states
5. ✅ Fix BOM character deployment bug
6. 🔄 **Homepage redesign** — new vertical scroll "Business OS" homepage
7. 🔄 **Navigation redesign** — aligned with 8 module structure
8. 🔄 **Security fix** — admin password → env var
9. 🔄 **SEO foundations** — sitemap.xml, robots.txt, updated metadata
10. 🔄 **Admin panel password** — replace hardcoded password with env var

**Deliverable:** frework.online looks like a real business product with honest state.

### PHASE 2 — Core Services (Next)
**Goal:** Make the compliance/services side actually work.

1. Unified service enquiry flow (one form → WhatsApp + email lead)
2. Service pages: Start (Company Registration), Comply (Income Tax, GST), Finance
3. Pricing page update for new module structure
4. Lead capture → Supabase `fw_leads` → admin dashboard notification
5. WhatsApp integration (actual WA Business API or wa.me links)
6. Service status dashboard (track what's been filed, next due dates)

**Deliverable:** Customers can enquire about any service and get a WhatsApp response.

### PHASE 3 — Marketplace (After Phase 2)
**Goal:** Build the supply side (professionals, workspaces) before showing demand.

1. Professional onboarding flow (Freelancer/CA/CS signup)
2. Manual verification workflow (admin approves each profile)
3. Search + filter for verified professionals
4. Coworking space owner onboarding
5. Verified space listings with real photos
6. Booking enquiry system

**Deliverable:** First 10-20 real, verified professionals and 3-5 coworking spaces listed.

### PHASE 4 — Startup Launchpad
**Goal:** Add investor-founder matching with real listings.

1. Startup profile creation (the Prisma schema already has this)
2. Investment round tracking
3. Investor outreach tools
4. DPR/Pitch deck generation assistant
5. Mentorship connect

**Deliverable:** 5-10 real startups with live fundraising profiles.

### PHASE 5 — Business Dashboard (The "OS" core)
**Goal:** Create the central dashboard that ties all modules together.

1. Business health score
2. Compliance calendar (ITR due dates, GST dates, ROC dates)
3. Document vault (store incorporation certificate, GST cert, etc.)
4. Team/employee management basics
5. Invoice tracker
6. Renewal reminders

**Deliverable:** Users have a reason to return to FreWork daily.

---

## PART 5: DESIGN SYSTEM

### Brand Colors
- Navy background: `#060C18`
- Gold accent: `#C9A84C` (primary CTA, headings)
- Gold light: `#E8C97A`
- White text: `rgba(255,255,255,0.9)` primary, `rgba(255,255,255,0.6)` secondary
- Module colors (per section):
  - START: Emerald (#10B981)
  - COMPLY: Blue (#3B82F6)
  - FINANCE: Purple (#8B5CF6)
  - PROFESSIONALS: Amber (#F59E0B)
  - GROW: Rose (#F43F5E)
  - WORKSPACE: Orange (#F97316)
  - LAUNCH: Indigo (#6366F1)
  - DASHBOARD: Gold (#C9A84C)

### Typography
- Headings: Plus Jakarta Sans (var(--font-plus-jakarta))
- Body: Poppins (var(--font-poppins))
- Decorative/serif: Cormorant Garamond (var(--font-cormorant))

---

## PART 6: SEO STRATEGY

### Target Keywords (Phase 1)
Primary: "business registration India", "GST registration", "company registration India", "income tax filing India", "CA services online India"

Secondary: "coworking space India", "hire freelancer India", "startup funding India", "business plan India"

Long-tail: "how to register a company in India", "GST registration process India", "income tax return filing online India"

### Content Plan
- Blog posts: Tax deadlines calendar, GST registration guide, How to register an LLP
- Guides: Company types in India (Pvt Ltd vs LLP vs OPC), GST input tax credit guide
- Tools: GST calculator, Income tax calculator, EMI calculator

---

## PART 7: REVENUE MODEL

### Freemium Services
- Free: Directory listing, basic dashboard, 1 service enquiry/month
- Starter ₹999/mo: 5 service requests, document storage, reminders
- Professional ₹2,999/mo: Unlimited requests, dedicated CA, priority support
- Business ₹7,999/mo: Full compliance management, bookkeeping, GST filing

### Marketplace Commission
- Freelancer bookings: 10-15% platform fee
- Coworking bookings: 5-10% booking fee
- Startup fundraising: 0.5-1% success fee

### Professional Subscriptions
- CA/CS profile listing: ₹999-2,999/year
- Priority placement: Additional ₹1,999/year

---

*Created: 2026-07-05*
*Status: Phase 1 in progress*
