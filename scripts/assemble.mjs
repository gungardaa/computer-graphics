import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit", shell: true });

// ponytail: P1-P5 copy byte exact, only P6 goes through vite build.
// Upgrade to full MPA build only if static copy ever diverges.
run("npm install --no-audit --no-fund", join(root, "practicum6"));
run("npm run build", join(root, "practicum6"));

const deploy = join(root, "deploy");
rmSync(deploy, { recursive: true, force: true });
mkdirSync(deploy, { recursive: true });

for (const f of ["index.html", "styles.css", "app.js"]) {
  cpSync(join(root, f), join(deploy, f));
}
for (const d of ["practicum1", "practicum2", "practicum3", "practicum4", "practicum5"]) {
  cpSync(join(root, d), join(deploy, d), {
    recursive: true,
    filter: (src) => !src.includes("node_modules"),
  });
}
cpSync(join(root, "practicum6", "dist"), join(deploy, "practicum6"), { recursive: true });

console.log("deploy ready at deploy/");
