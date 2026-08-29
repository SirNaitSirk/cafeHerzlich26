import type { MetadataRoute } from "next";

// Standalone PWA so the terminal launches full-screen from the iPad home
// screen — no Safari chrome, no visible URL. All assets are local (offline Pi).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cafe Herzlich Bestell-Terminal",
    short_name: "Cafe Herzlich",
    description: "Bestell-Terminal Cafe Herzlich",
    lang: "de",
    start_url: "/terminal",
    display: "standalone",
    orientation: "landscape",
    background_color: "#1c1917",
    theme_color: "#1c1917",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
