import { handlers } from "@/lib/auth";

export const runtime = "nodejs";

// Auth.js mounts its OAuth callback / sign-in / sign-out endpoints here.
export const { GET, POST } = handlers;
