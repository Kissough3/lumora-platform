import test from "node:test";
import assert from "node:assert/strict";
import { can, isRole, ROLES, ROLE_PERMISSIONS } from "./permissions.ts";

test("owner has every permission", () => assert.ok(can("owner", "organization.manage") && can("owner", "audit.read")));
test("client has no staff permissions", () => assert.equal(ROLE_PERMISSIONS.client.length, 0));
test("editor cannot read payments", () => assert.equal(can("editor", "payments.read"), false));
test("accountant can manage payments but not clients", () => {
  assert.ok(can("accountant", "payments.manage"));
  assert.equal(can("accountant", "clients.create"), false);
});
test("unknown or forged roles are denied", () => {
  assert.equal(can("superadmin", "organization.read"), false);
  assert.equal(can(undefined, "organization.read"), false);
  assert.equal(isRole("owner"), true);
});
test("every role is defined in the map", () => ROLES.forEach((r) => assert.ok(ROLE_PERMISSIONS[r])));
