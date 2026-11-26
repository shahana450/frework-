"use client";
import { useEffect } from "react";

// Marks the page as started, which hides the loading card the server sends with every page (see app/layout.tsx).
export default function BootReady() {
  useEffect(() => { document.documentElement.dataset.ready = "1"; }, []);
  return null;
}
