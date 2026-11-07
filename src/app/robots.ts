import type { MetadataRoute } from "next";

// Las pantallas de un grupo concreto (firmar, cerrar, unirse) son privadas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/g/", "/sign", "/done", "/join", "/login", "/plan"] },
    sitemap: "https://squash-pay.vercel.app/sitemap.xml",
  };
}
