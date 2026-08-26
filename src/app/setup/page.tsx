import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DEVICE_ROLE_COOKIE, STAFF_ROLES, isStaffRole, type StaffRole } from "@/lib/roles";

/**
 * One-time device setup: assign this device a staff role. Stores the role in a
 * cookie so middleware can gate the staff surfaces. Public devices (terminal,
 * abholung) don't need setup.
 *
 * NOTE (foundation stub): plain cookie for now — hardening (signing/httpOnly)
 * comes with the device-role feature prompt.
 */
const ROLE_LABELS: Record<StaffRole, string> = {
  kasse: "Kasse",
  kueche: "Küche",
  admin: "Admin",
};

async function assignRole(formData: FormData): Promise<void> {
  "use server";
  const role = formData.get("role");
  const next = formData.get("next");
  if (typeof role !== "string" || !isStaffRole(role)) return;

  const store = await cookies();
  store.set(DEVICE_ROLE_COOKIE, role, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect(typeof next === "string" && next.startsWith("/") ? next : `/${role}`);
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gerät einrichten</h1>
        <p className="text-muted-foreground">
          Diesem Gerät eine Rolle zuweisen. Die Auswahl bleibt gespeichert.
        </p>
      </header>
      <div className="grid gap-3">
        {STAFF_ROLES.map((role) => (
          <form action={assignRole} key={role}>
            <input type="hidden" name="role" value={role} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <Button type="submit" variant="outline" className="h-14 w-full text-base">
              {ROLE_LABELS[role]}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
