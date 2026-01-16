import { ConvexHttpClient } from "convex/browser";

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return url;
}

export const getConvexClient = () => {
  return new ConvexHttpClient(getConvexUrl());
};

export function getConvexClientWithAuth(token: string): ConvexHttpClient {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  return client;
}

export function getConvexAdminClient(adminToken?: string): ConvexHttpClient {
  const token = adminToken ?? process.env.CONVEX_ADMIN_TOKEN;
  if (!token) {
    throw new Error("CONVEX_ADMIN_TOKEN is not set");
  }

  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  return client;
}
