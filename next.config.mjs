/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @node-rs/argon2 is a native module; keep it external to the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
