import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  // Next.js 16 デフォルトの Turbopack と next-pwa (webpack ベース) の共存設定
  turbopack: {},
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    navigateFallback: "/dashboard",
    navigateFallbackDenylist: [
      /^\/login/,
      /^\/attendance/,
      /^\/shift\/submit/,
      /^\/api\//,
    ],
    runtimeCaching: [
      // Supabase API: 常にネットワーク経由（認証・データ保護）
      {
        urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
      // Next.js 静的アセット: CacheFirst
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      // 画像: CacheFirst
      {
        urlPattern: /^\/_next\/image\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-image",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
      // 参照系ページ: NetworkFirst（5秒でフォールバック）
      {
        urlPattern: /^\/(?:dashboard|shift\/view|salary\/view|attendance\/history)/,
        handler: "NetworkFirst",
        options: {
          cacheName: "page-cache",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
        },
      },
    ],
  },
})(nextConfig);
