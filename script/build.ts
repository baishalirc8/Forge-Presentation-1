import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  if (existsSync("server/seed-data.json")) {
    await copyFile("server/seed-data.json", "dist/seed-data.json");
    console.log("copied seed-data.json to dist/");
  }

  if (existsSync("uploads")) {
    const destUploads = path.join("dist", "uploads");
    await mkdir(destUploads, { recursive: true });
    const files = await readdir("uploads");
    let copied = 0;
    for (const file of files) {
      await copyFile(path.join("uploads", file), path.join(destUploads, file));
      copied++;
    }
    console.log(`copied ${copied} upload files to dist/uploads/`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
