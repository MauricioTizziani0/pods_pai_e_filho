import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pods - Pai e Filho",
    short_name: "Pods",
    description: "Estoque, vendas, lucro e repasses.",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/mobile-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/mobile-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/mobile-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
