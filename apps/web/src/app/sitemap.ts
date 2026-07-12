import type { MetadataRoute } from "next";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online").replace(/^﻿/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL,                                    lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/services`,                      lastModified: now, changeFrequency: "weekly",  priority: 0.95 },
    { url: `${BASE_URL}/services/gst-registration`,    lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/services/gst-filing`,          lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/services/income-tax`,          lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/services/company-registration`,lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/services/accounting`,          lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/services/audit`,               lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/services/compliance`,          lastModified: now, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${BASE_URL}/services/dpr`,                 lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/pitch-decks`,         lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/restructuring`,       lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/training`,            lastModified: now, changeFrequency: "monthly", priority: 0.7  },
    { url: `${BASE_URL}/contact`,                      lastModified: now, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE_URL}/pricing`,                      lastModified: now, changeFrequency: "monthly", priority: 0.8  },
    { url: `${BASE_URL}/freelancers`,                  lastModified: now, changeFrequency: "weekly",  priority: 0.75 },
    { url: `${BASE_URL}/coworking`,                    lastModified: now, changeFrequency: "weekly",  priority: 0.75 },
    { url: `${BASE_URL}/jobs`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.7  },
    { url: `${BASE_URL}/about`,                        lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${BASE_URL}/blog`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.65 },
    { url: `${BASE_URL}/register`,                     lastModified: now, changeFrequency: "yearly",  priority: 0.5  },
  ];
}
