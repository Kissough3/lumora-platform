export const ROLES = ["owner","admin","manager","photographer","editor","assistant","accountant","client"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "organization.read","organization.manage",
  "clients.read","clients.create","clients.update",
  "projects.read","projects.create","projects.update",
  "media.read","media.upload","media.process",
  "gallery.manage","gallery.publish",
  "payments.read","payments.manage",
  "ai.execute","automation.manage","audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];
const without = (...p: Permission[]) => ALL.filter((x) => !p.includes(x));

// Single source of truth. Mirror any change in SQL function lumora_has_permission().
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  admin: without("organization.manage"),
  manager: without("organization.manage","payments.manage","audit.read"),
  photographer: ["organization.read","clients.read","projects.read","media.read","media.upload"],
  editor: ["organization.read","projects.read","media.read","media.process"],
  assistant: ["organization.read","clients.read","clients.create","clients.update","projects.read","projects.create","projects.update"],
  accountant: ["organization.read","clients.read","projects.read","payments.read","payments.manage"],
  client: [],
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function can(role: unknown, permission: Permission): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}
