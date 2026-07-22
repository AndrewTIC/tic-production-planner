import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { login } from "./actions";

// Login: the front door. The backdrop is the TIC swoosh, slowed down —
// two drifting lime arcs and soft glows behind a calm card. Pure CSS
// animation (keyframes in globals.css), stilled for reduced-motion users.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-50 p-6 dark:bg-zinc-950">
      {/* ── Dynamic backdrop ─────────────────────────────────────── */}
      {/* Soft colour blobs roaming the whole canvas — TIC lime greens plus
          a cool accent for depth. Heavily blurred so they read as a slow,
          living gradient rather than shapes. Each blob has its own path. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-roam-a absolute left-[8%] top-[12%] h-[30rem] w-[30rem] rounded-full bg-lime-500/40 blur-3xl dark:bg-lime-500/20" />
        <div className="animate-roam-b absolute right-[6%] top-[20%] h-[32rem] w-[32rem] rounded-full bg-lime-700/30 blur-3xl dark:bg-lime-700/20" />
        <div className="animate-roam-c absolute bottom-[6%] left-[30%] h-[28rem] w-[28rem] rounded-full bg-emerald-400/30 blur-3xl dark:bg-emerald-500/15" />
        <div className="animate-roam-a absolute bottom-[14%] right-[24%] h-[24rem] w-[24rem] rounded-full bg-lime-300/40 blur-3xl dark:bg-teal-500/15" />
      </div>

      {/* Theme choice available before signing in */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* ── Card ─────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm rounded-3xl border border-zinc-200/80 bg-white/95 p-8 shadow-(--shadow-3) backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/TIC-logo.png"
            alt="TIC"
            width={76}
            height={72}
            priority
            className="h-16 w-auto"
          />
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Production Planner
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Engineered Services Division
          </p>
        </div>

        <form action={login} className="mt-7 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Sign-in failed — check the email and password.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-lime-500 px-4 py-2.5 font-semibold text-neutral-800 hover:bg-lime-600 focus:outline-none focus:ring-2 focus:ring-lime-800 focus:ring-offset-2"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Accounts are managed by an administrator — there is no self-service
          sign-up.
        </p>
      </div>
    </main>
  );
}
