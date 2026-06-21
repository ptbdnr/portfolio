import { currentUser, isAdmin } from "@/lib/auth";
import SiteHeader from "./SiteHeader";

// Server wrapper: reads the session and hands the bare state to the client bar.
export default async function TopNav() {
  const user = await currentUser();
  const admin = user ? await isAdmin() : false;
  return (
    <SiteHeader user={user ? { email: user.email } : null} isAdmin={admin} />
  );
}
