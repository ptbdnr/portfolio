// Centered content column for inner pages. The cursor-light effect and the top
// navigation are mounted globally in the root layout, so this only sets width.
export default function ContentShell({
  children,
  width = "wide",
}: {
  children: React.ReactNode;
  width?: "wide" | "narrow";
}) {
  return (
    <main
      className={`mx-auto p-8 ${
        width === "narrow" ? "max-w-3xl" : "max-w-[1200px]"
      }`}
    >
      {children}
    </main>
  );
}
