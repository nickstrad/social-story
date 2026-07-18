import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/inngest": [
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    ],
  },
}

export default nextConfig
