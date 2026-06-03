import { FamilyApp } from "@/components/family-app";

export default function BankCardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FamilyApp>{children}</FamilyApp>;
}
