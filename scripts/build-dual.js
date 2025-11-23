#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execAsync = promisify(exec);

async function buildDual() {
  console.log("🏗️  Building dual CommonJS and ESM packages...");

  // Clean dist directory
  try {
    await fs.rm("dist", { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, that's fine
  }

  // Create directories
  await fs.mkdir("dist/esm", { recursive: true });
  await fs.mkdir("dist/cjs", { recursive: true });

  // Build ESM version (source files already have .js extensions)
  console.log("📦 Building ESM version...");
  await execAsync("pnpm tsc -p tsconfig.json");

  // For CommonJS, we need to create temporary source files without .js extensions
  console.log("📦 Building CommonJS version...");

  // Create temporary source directory for CJS build
  const tempSrcDir = "src-temp-cjs";
  await fs.mkdir(tempSrcDir, { recursive: true });

  try {
    // Copy and modify source files for CJS build
    const srcFiles = await getAllTsFiles("src");

    for (const file of srcFiles) {
      const content = await fs.readFile(file, "utf-8");
      const relativePath = path.relative("src", file);
      const tempFile = path.join(tempSrcDir, relativePath);

      // Ensure directory exists
      await fs.mkdir(path.dirname(tempFile), { recursive: true });

      // Remove .js extensions from relative imports for CommonJS
      const modifiedContent = content
        .replace(
          /(from\s+["'])(\.{1,2}\/[^"']+)\.js(["'])/g,
          (_, prefix, relPath, suffix) => `${prefix}${relPath}${suffix}`,
        )
        .replace(
          /(import\()\s*(["'])(\.{1,2}\/[^"']+)\.js\2(\s*\))/g,
          (_, start, quote, relPath, end) =>
            `${start}${quote}${relPath}${quote}${end}`,
        );

      await fs.writeFile(tempFile, modifiedContent);
    }

    // Build CommonJS with temporary source files
    const cjsConfig = {
      extends: "./tsconfig.json",
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "./dist/cjs",
        rootDir: `./${tempSrcDir}`,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: [`${tempSrcDir}/**/*.ts`],
    };

    await fs.writeFile(
      "tsconfig.temp.json",
      JSON.stringify(cjsConfig, null, 2),
    );
    await execAsync("pnpm tsc -p tsconfig.temp.json");
  } finally {
    // Clean up temporary files
    await fs.rm(tempSrcDir, { recursive: true, force: true });
    await fs.rm("tsconfig.temp.json", { force: true });
  }

  // Create package.json files for each build
  console.log("📝 Creating package.json files...");

  // ESM package.json
  await fs.writeFile(
    "dist/esm/package.json",
    JSON.stringify(
      {
        type: "module",
      },
      null,
      2,
    ),
  );

  // CJS package.json
  await fs.writeFile(
    "dist/cjs/package.json",
    JSON.stringify(
      {
        type: "commonjs",
      },
      null,
      2,
    ),
  );

  console.log("✅ Dual build completed successfully!");
}

async function getAllTsFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

buildDual().catch((error) => {
  console.error("❌ Build failed:", error);
  process.exit(1);
});
