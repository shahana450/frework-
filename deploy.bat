@echo off
echo Deploying FreWork brand updates...
cd /d "%~dp0"

echo Removing git lock file...
del /f ".git\index.lock" 2>nul

echo Staging changed files...
git add apps/web/src/app/layout.tsx
git add apps/web/src/app/page.tsx
git add "apps/web/src/app/freelancers/[id]/page.tsx"
git add apps/web/src/app/jobs/post/page.tsx
git add apps/web/src/app/pricing/page.tsx
git add apps/web/src/components/landing/faq.tsx
git add apps/web/src/components/landing/featured-freelancers.tsx
git add apps/web/src/components/landing/hero.tsx
git add apps/web/src/components/landing/pricing.tsx
git add apps/web/src/components/landing/stats.tsx
git add apps/web/src/components/landing/testimonials.tsx
git add apps/web/tailwind.config.ts

echo Committing...
git commit -m "Apply FreWork brand guidelines: Poppins font, brand colors, fix WorkSphere references, Indian freelancers, INR pricing, honest stats"

echo Pushing to GitHub (Vercel will auto-deploy)...
git push origin main

echo.
echo Done! Vercel will now redeploy frework.online automatically.
echo Check https://vercel.com for deployment progress.
pause
