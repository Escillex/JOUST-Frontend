import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Joust | Hobby+",
};

export default function TournamentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
