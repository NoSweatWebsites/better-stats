import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@betterstats/db'],
  output: 'standalone',
}

export default nextConfig
