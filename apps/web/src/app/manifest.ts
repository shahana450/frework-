import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FreWork",
    short_name: "FreWork",
    description: "The Operating System for Indian Businesses — Start, Run and Grow.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F3F6",
    theme_color: "#232A63",
    icons: [
      { src: "/frebook-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/frebook-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/frebook-icon/512m", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
