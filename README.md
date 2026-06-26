# WorkSphere Global 🌍

**The World's Most Complete Professional Ecosystem**

> Find Talent. Find Workspace. Build Your Future.

[![CI/CD](https://github.com/worksphere/worksphere-global/actions/workflows/ci.yml/badge.svg)](https://github.com/worksphere/worksphere-global/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

WorkSphere Global is an enterprise-grade SaaS platform that combines the best of Upwork, LinkedIn, Airbnb, WeWork, and Fiverr into a single unified ecosystem. It connects:

- **Freelancers** with global clients
- **Coworking spaces** with professionals
- **Startups** with investors and talent
- **Businesses** with consultants and agencies

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion |
| Backend | NestJS, PostgreSQL (pgvector), Prisma ORM, Redis, Elasticsearch |
| Auth | JWT, OAuth (Google, LinkedIn, GitHub, Microsoft), OTP, 2FA |
| Payments | Stripe, Razorpay, PayPal, Wise |
| AI | OpenAI GPT-4o, text-embedding-3-small |
| Storage | AWS S3, CloudFront |
| Realtime | Socket.io, WebRTC |
| DevOps | Docker, Kubernetes, GitHub Actions, AWS EKS |

---

## Project Structure

```
worksphere-global/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/     # React components
│   │   │   │   ├── landing/    # Homepage sections
│   │   │   │   ├── layout/     # Navbar, Footer
│   │   │   │   ├── ui/         # Shadcn UI primitives
│   │   │   │   ├── dashboard/  # Dashboard components
│   │   │   │   └── shared/     # Shared components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities, API client
│   │   │   ├── store/          # Zustand state
│   │   │   └── types/          # TypeScript types
│   │   └── Dockerfile
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/       # JWT + OAuth auth
│       │   │   ├── users/      # User management
│       │   │   ├── freelancers/# Freelancer profiles
│       │   │   ├── projects/   # Job postings
│       │   │   ├── coworking/  # Workspace module
│       │   │   ├── bookings/   # Booking system
│       │   │   ├── payments/   # Stripe/Razorpay
│       │   │   ├── messaging/  # Real-time chat
│       │   │   ├── startups/   # Startup hub
│       │   │   ├── investors/  # Investor portal
│       │   │   ├── ai/         # AI features
│       │   │   ├── admin/      # Admin panel
│       │   │   └── search/     # Elasticsearch
│       │   ├── common/         # Guards, filters, interceptors
│       │   ├── config/         # Configuration
│       │   └── database/       # Prisma service
│       └── Dockerfile
├── packages/
│   └── database/
│       └── prisma/
│           ├── schema.prisma   # Full database schema
│           └── seed.ts         # Database seeder
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   ├── terraform/
│   └── nginx/
├── .github/workflows/          # CI/CD pipelines
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── turbo.json
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 with pgvector
- Redis 7+

### 1. Clone & Install

```bash
git clone https://github.com/worksphere/worksphere-global.git
cd worksphere-global
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start with Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Elasticsearch)
npm run docker:dev

# Or start just the infrastructure
docker-compose -f docker-compose.dev.yml up postgres redis elasticsearch -d
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 5. Start Development Servers

```bash
# Start both web and api
npm run dev

# Or individually
npm run dev --workspace=apps/web   # http://localhost:3000
npm run dev --workspace=apps/api   # http://localhost:4000
```

---

## API Documentation

Swagger UI is available at: `http://localhost:4000/api/docs`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/google` | Google OAuth |
| GET | `/api/v1/users/me` | Current user |
| GET | `/api/v1/freelancers` | List freelancers |
| POST | `/api/v1/projects` | Create project |
| POST | `/api/v1/applications` | Apply to project |
| GET | `/api/v1/coworking` | List spaces |
| POST | `/api/v1/bookings` | Book workspace |
| POST | `/api/v1/payments/checkout` | Create payment |
| POST | `/api/v1/ai/proposal` | Generate proposal |
| POST | `/api/v1/ai/resume` | Generate resume |
| GET | `/api/v1/search` | Global search |

---

## Seed Credentials

After running `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@worksphere.global | Admin@123456 |
| Freelancer | sarah.chen@example.com | Test@123456 |
| Client | michael.torres@example.com | Test@123456 |

---

## User Types

| Role | Description |
|------|-------------|
| `FREELANCER` | Independent professionals offering services |
| `CLIENT` | Businesses posting projects |
| `COWORKING_OWNER` | Workspace owners listing spaces |
| `STARTUP` | Startups seeking funding & talent |
| `INVESTOR` | VCs and angel investors |
| `AGENCY` | Agencies with team management |
| `CONSULTANT` | Expert consultants |
| `RECRUITER` | Talent acquisition professionals |
| `ADMIN` | Platform administrators |

---

## AI Features

| Feature | Description |
|---------|-------------|
| Resume Builder | GPT-4o generates ATS-optimized resumes |
| Proposal Generator | Personalized cover letters for jobs |
| Job Matching | Skill-based freelancer-to-project matching |
| Workspace Recommendation | AI suggests optimal coworking spaces |
| Meeting Summary | Transcript analysis with action items |
| AI Translation | 50+ language support |
| Chat Assistant | Platform navigation helper |

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# With coverage
npm run test -- --coverage
```

---

## Deployment

### Production with Docker

```bash
# Build and push images
docker build -t worksphere-api:latest ./apps/api
docker build -t worksphere-web:latest ./apps/web

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Run migrations in production
docker exec worksphere_api npx prisma migrate deploy
```

### Kubernetes (AWS EKS)

```bash
# Apply manifests
kubectl apply -f infrastructure/kubernetes/manifests/ -n production

# Check rollout
kubectl rollout status deployment/worksphere-api -n production
```

### Environment Variables Required for Production

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string  
- `JWT_SECRET` — Min 32 chars, randomly generated
- `JWT_REFRESH_SECRET` — Min 32 chars, different from JWT_SECRET
- `OPENAI_API_KEY` — For AI features
- `STRIPE_SECRET_KEY` — For payments
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` — For S3 storage

---

## Security

- JWT with short-lived access tokens (15m) + refresh tokens (7d)
- OAuth 2.0 for social login
- Passwords hashed with bcrypt (12 rounds)
- Rate limiting on all endpoints (configurable per route)
- SQL injection prevention via Prisma ORM
- XSS protection via security headers
- CORS configured for specific origins
- KYC/identity verification for freelancers
- Escrow payment system for safe transactions
- 2FA support (TOTP)
- GDPR compliance ready

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built with ❤️ by the WorkSphere team. Questions? Email support@worksphere.global*
