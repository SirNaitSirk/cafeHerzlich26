/**
 * Device roles. Each physical device is assigned a role once (stored in a cookie);
 * middleware gates the staff surfaces. This is a trusted LAN — not a login system.
 *
 * Public surfaces (terminal, abholung) need no role.
 */
export const DEVICE_ROLES = ["terminal", "kasse", "kueche", "abholung", "admin"] as const;
export type DeviceRole = (typeof DEVICE_ROLES)[number];

/** Roles that require the device to be explicitly assigned before use. */
export const STAFF_ROLES = ["kasse", "kueche", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const DEVICE_ROLE_COOKIE = "device_role";

export function isDeviceRole(value: string | undefined | null): value is DeviceRole {
  return !!value && (DEVICE_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(value: string | undefined | null): value is StaffRole {
  return !!value && (STAFF_ROLES as readonly string[]).includes(value);
}
