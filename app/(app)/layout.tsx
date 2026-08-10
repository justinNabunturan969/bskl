import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Mic, Trash2, LogOut, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 flex-col border-r bg-card">
        <div className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">BSKL</span>
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
          <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
          <NavLink href="/record" icon={Mic}>Record</NavLink>
          <NavLink href="/trash" icon={Trash2}>Trash</NavLink>
        </nav>
        <Separator />
        <div className="p-3 space-y-2">
          <p className="text-sm font-medium truncate px-2">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate px-2">{user.email}</p>
          <form action={signOut}>
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden border-b bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between p-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">BSKL</span>
          </Link>
          <form action={signOut}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
        <nav className="flex border-t" aria-label="Mobile navigation">
          <MobileNavLink href="/dashboard" icon={LayoutDashboard}>Home</MobileNavLink>
          <MobileNavLink href="/record" icon={Mic}>Record</MobileNavLink>
          <MobileNavLink href="/trash" icon={Trash2}>Trash</MobileNavLink>
        </nav>
      </header>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors focus-visible:bg-muted"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function MobileNavLink({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center gap-1 py-2 text-xs hover:bg-muted transition-colors"
    >
      <Icon className="h-5 w-5" />
      {children}
    </Link>
  );
}