import type { MetadataRoute } from "next";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://frework.online").replace(/^﻿/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL,                                       lastModified: now, changeFrequency: "weekly",  priority: 1.0  },
    { url: `${BASE_URL}/services`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.95 },
    { url: `${BASE_URL}/services/gst`,                    lastModified: now, changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE_URL}/services/income-tax`,             lastModified: now, changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE_URL}/services/accounting`,             lastModified: now, changeFrequency: "monthly", priority: 0.9  },
    { url: `${BASE_URL}/services/audit`,                  lastModified: now, changeFrequency: "monthly", priority: 0.88 },
    { url: `${BASE_URL}/services/business-registration`,  lastModified: now, changeFrequency: "monthly", priority: 0.88 },
    { url: `${BASE_URL}/services/compliance`,             lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/services/roc-compliance`,         lastModified: now, changeFrequency: "monthly", priority: 0.82 },
    { url: `${BASE_URL}/services/virtual-cfo`,            lastModified: now, changeFrequency: "monthly", priority: 0.80 },
    { url: `${BASE_URL}/services/dpr`,                    lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/pitch-decks`,            lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/restructuring`,          lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${BASE_URL}/services/training`,               lastModified: now, changeFrequency: "monthly", priority: 0.70 },
    { url: `${BASE_URL}/contact`,                         lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${BASE_URL}/pricing`,                         lastModified: now, changeFrequency: "monthly", priority: 0.82 },
    { url: `${BASE_URL}/blog`,                            lastModified: now, changeFrequency: "weekly",  priority: 0.75 },
    { url: `${BASE_URL}/blog/gst-registration-guide`,    lastModified: now, changeFrequency: "monthly", priority: 0.80 },
    { url: `${BASE_URL}/blog/itr-filing-guide`,          lastModified: now, changeFrequency: "monthly", priority: 0.80 },
    { url: `${BASE_URL}/blog/company-registration-india`,lastModified: now, changeFrequency: "monthly", priority: 0.78 },
    { url: `${BASE_URL}/freelancers`,                     lastModified: now, changeFrequency: "weekly",  priority: 0.72 },
    { url: `${BASE_URL}/coworking`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.72 },
    { url: `${BASE_URL}/jobs`,                            lastModified: now, changeFrequency: "weekly",  priority: 0.70 },
    { url: `${BASE_URL}/about`,                           lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${BASE_URL}/register`,                        lastModified: now, changeFrequency: "yearly",  priority: 0.50 },
  ];
}
