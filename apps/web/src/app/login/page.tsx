import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Creds = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });

async function signIn(formData: FormData) {
  "use server";
  const parsed = Creds.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=auth");
  redirect("/dashboard");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 360, margin: "20vh auto", padding: 24 }}>
      <h1>LUMORA</h1>
      <form action={signIn} style={{ display: "grid", gap: 12 }}>
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        <button type="submit">Sign in</button>
        {error && <p role="alert">Sign-in failed. Check your details.</p>}
      </form>
    </main>
  );
}
