import { NextResponse, type NextRequest } from "next/server";

import { DEVICE_ROLE_COOKIE, type DeviceRole } from "@/lib/roles";

/**
 * Device-role gate for the staff surfaces (Kasse, Küche, Admin).
 *
 * Each device is assigned a role once at `/setup`, stored in a cookie. Each
 * protected path lists the roles allowed to open it. A Kasse device may work in
 * the Admin dashboard too, so `/admin` accepts both `admin` and `kasse`. Public
 * surfaces (terminal, abholung) and the setup page are always reachable.
 *
 * NOTE (foundation stub): the cookie is read as-is for now. Signing/httpOnly
 * hardening is handled in the dedicated device-role feature prompt.
 */
const ROUTE_ROLES: { prefix: string; roles: readonly DeviceRole[] }[] = [
  { prefix: "/kasse", roles: ["kasse"] },
  { prefix: "/kueche", roles: ["kueche"] },
  { prefix: "/admin", roles: ["admin", "kasse"] },
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get(DEVICE_ROLE_COOKIE)?.value;

  for (const { prefix, roles } of ROUTE_ROLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!role || !(roles as readonly string[]).includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/setup";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/kasse/:path*", "/kueche/:path*", "/admin/:path*"],
};
