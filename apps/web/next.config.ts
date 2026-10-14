import type { NextConfig } from 'next'

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000'

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: '/static/:path*', destination: `${backendUrl}/static/:path*` }]
  },
}

export default nextConfig
