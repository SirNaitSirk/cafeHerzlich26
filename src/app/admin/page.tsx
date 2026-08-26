import { cookies } from "next/headers";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminCatalog, getAdminModifierGroups } from "@/lib/admin-catalog";
import { DEVICE_ROLE_COOKIE } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const categories = getAdminCatalog();
  const modifierGroups = getAdminModifierGroups();
  const settings = getSettings();
  // A Kasse device works here too — show it a way back to the till.
  const role = (await cookies()).get(DEVICE_ROLE_COOKIE)?.value;

  return (
    <AdminDashboard
      initialCategories={categories}
      initialModifierGroups={modifierGroups}
      initialSettings={settings}
      showKasseLink={role === "kasse"}
    />
  );
}
