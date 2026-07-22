# Running the planner from your desktop

How Andrew (or Liam) starts the planner each day while it is not yet
deployed. One double-click once set up.

## One-time setup: a desktop shortcut

Run this once in PowerShell (from anywhere):

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$env:USERPROFILE\Desktop\Production Planner.lnk")
$s.TargetPath = "powershell.exe"
$s.Arguments  = '-ExecutionPolicy Bypass -File "C:\Users\andre\tic-production-planner\start-planner.ps1"'
$s.IconLocation = "C:\Program Files\Docker\Docker\Docker Desktop.exe,0"
$s.Save()
```

(Adjust the repo path on Liam's machine.)

## Each time you want the planner

1. Double-click **Production Planner** on the desktop.
2. Wait for the URLs to print — it starts Docker and the database itself,
   including after a reboot (it clears Supabase's stale "already running"
   lock automatically).
3. Open **http://localhost:3000**, or share the printed
   `http://<your-ip>:3000` address with anyone on the office network.
4. Leave the window open. Ctrl+C (or closing it) stops the web app; the
   database keeps running quietly in Docker until `npx supabase stop`.

First time another PC connects, Windows may ask to allow Node through the
firewall — allow it on **Private** networks.

## Useful commands (from the repo folder)

| Command | What |
|---|---|
| `npx supabase stop` | stop the database containers (data is kept) |
| `npx supabase status` | URLs + keys for the running stack |
| `npm run dev:lan` | just the web app, network-visible (stack already up) |
| `select public.auto_close_open_time_entries();` | in Studio SQL — the manual end-of-shift sweep (see trial-notes §5) |

**Never run `npx supabase db reset` once real trial data exists** — it
wipes back to the seed.
