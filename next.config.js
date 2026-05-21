/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" } // Spotify album covers
    ]
  }
};

module.exports = nextConfig;
