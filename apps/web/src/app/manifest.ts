import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FreWork",
    short_name: "FreWork",
    description: "The Operating System for Indian Businesses — Start, Run and Grow.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF5",
    theme_color: "#B8903A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
