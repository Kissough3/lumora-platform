export const metadata = { title: "LUMORA" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ fontFamily: "system-ui", margin: 0, background: "#0b0b0d", color: "#eee" }}>{children}</body></html>);
}
