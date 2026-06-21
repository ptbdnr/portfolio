import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Peter Bodnar",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="mx-auto max-w-[1000px] p-8">{children}</main>;
}
