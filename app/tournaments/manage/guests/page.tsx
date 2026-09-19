import ManagerLayout from "../../../components/manage/ManagerLayout";
import GuestRegistry from "../../../components/manage/GuestRegistry";

export default async function GuestRegistrationPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <ManagerLayout breadcrumbs={[{ label: "Manage", href: "/tournaments/manage" }, { label: "Guest registration" }]}>
      <GuestRegistry initialQuery={typeof q === "string" ? q : ""} />
    </ManagerLayout>
  );
}
