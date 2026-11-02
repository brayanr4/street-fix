import type { MetadataRoute } from "next";

// Lets people add Street Fix to their phone's home screen and open it full screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Street Fix",
    short_name: "Street Fix",
    description: "Snap a problem on your street. Street Fix reports it to the right agency and follows up until it's fixed.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#047857",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
