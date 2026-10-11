import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://squash-pay.vercel.app";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/nuevo`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/grupo`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
