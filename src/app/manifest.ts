import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Squash",
    short_name: "Squash",
    description: "Split the bill at the table. Nobody pays until everyone says yes.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1319",
    theme_color: "#0e1319",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
