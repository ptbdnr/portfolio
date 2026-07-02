import type { Metadata } from "next";
import ContentShell from "@/components/ContentShell";
import Reveal from "@/components/Reveal";
import Intro from "@/components/Intro";
import WorkSection from "@/components/WorkSection";
import EducationSection from "@/components/EducationSection";

export const metadata: Metadata = {
  title: "About — Peter Bodnar",
  description:
    "Peter Bodnar — ML/AI Engineer. Background, work experience, and education.",
};

export default function AboutPage() {
  return (
    <ContentShell>
      <Reveal>
        <Intro />
      </Reveal>
      <WorkSection />
      <EducationSection />
    </ContentShell>
  );
}
