import { FamilyApp } from "@/components/family-app";
import { ErrorBoundary } from "@/components/error-boundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <FamilyApp />
    </ErrorBoundary>
  );
}
