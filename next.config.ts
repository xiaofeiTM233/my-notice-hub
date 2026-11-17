import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // 允许局域网与 127.0.0.1 访问开发服务器，避免 hydration 资源被跨域拦截。
  allowedDevOrigins: ['127.0.0.1', '192.168.2.2'],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
