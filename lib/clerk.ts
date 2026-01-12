import { clerkClient } from "@clerk/nextjs/server";

export async function getClerkUser(userId: string) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user;
  } catch (error) {
    console.error("Error fetching Clerk user:", error);
    return null;
  }
}

export async function getClerkUserEmail(userId: string) {
  const user = await getClerkUser(userId);
  return user?.emailAddresses[0]?.emailAddress ?? null;
}

export async function getClerkUserFullName(userId: string) {
  const user = await getClerkUser(userId);
  return user?.firstName ?? null;
}
