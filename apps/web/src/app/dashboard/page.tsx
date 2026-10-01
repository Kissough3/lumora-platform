import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const OrgName = z.string().trim().min(2).max(120);

async function createOrg(formData: FormData) {
  "use server";
  const name = OrgName.safeParse(formData.get("name"));
  if (!name.success) redirect("/dashboard?error=name");
  const supabase = await createClient();
  const { error } = await supabase.rpc("lumora_create_organization", { org_name: name.data });
  if (error) redirect("/dashboard?error=create");
  redirect("/dashboard");
}

async function count(table: string) {
  const supabase = await createClient();
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0; // RLS scopes this to the caller's organizations
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: orgs } = await supabase.from("organizations").select("id,name");

  if (!orgs?.length) {
    return (
      <main style={{ maxWidth: 420, margin: "15vh auto", padding: 24 }}>
        <h1>Create your studio</h1>
        <form action={createOrg} style={{ display: "grid", gap: 12 }}>
          <input name="name" placeholder="Studio name" required minLength={2} maxLength={120} />
          <button type="submit">Create</button>
        </form>
      </main>
    );
  }

  const [clients, leads, projects, tasks] = await Promise.all(["clients","leads","projects","tasks"].map(count));
  const cards = { Clients: clients, Leads: leads, Projects: projects, Tasks: tasks };
  return (
    <main style={{ padding: 32 }}>
      <h1>{orgs[0].name}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
        {Object.entries(cards).map(([k, v]) => (
          <section key={k} style={{ background: "#16161a", borderRadius: 12, padding: 20 }}>
            <div style={{ opacity: 0.6 }}>{k}</div><div style={{ fontSize: 32 }}>{v}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
