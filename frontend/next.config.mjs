/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy API requests to the backend to avoid CORS issues in development.
  // The frontend calls /api/v1/... which Next.js rewrites to the backend.
  // In production, configure your reverse proxy (nginx, Cloudflare, etc.) instead.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
