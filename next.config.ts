import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is demonstrated on a board screen; keep the dev-mode badge off the frame.
  devIndicators: false,
  // The timetable database is opened at runtime (not imported), so tell the bundler to ship it with every route.
  // The raw source data and the local app database stay out of the deployment.
  outputFileTracingIncludes: { "/*": ["./data/rail.db"] },
  outputFileTracingExcludes: { "/*": ["./data/raw/**/*", "./data/app.db*"] },
};

export default nextConfig;
