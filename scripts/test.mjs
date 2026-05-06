import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const root = process.cwd();
const testRoot = resolve(root, "tests");

async function findTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) return findTests(path);
      return entry.name.endsWith(".test.ts") ? [path] : [];
    })
  );
  return files.flat();
}

const server = await createServer({
  configFile: false,
  root,
  logLevel: "error"
});

let failed = 0;

try {
  const files = await findTests(testRoot);

  for (const file of files) {
    const modulePath = `/${relative(root, file).split(sep).join("/")}`;
    const module = await server.ssrLoadModule(modulePath);
    const tests = Array.isArray(module.tests) ? module.tests : [];

    for (const test of tests) {
      try {
        await test.run();
        console.log(`✓ ${test.name}`);
      } catch (error) {
        failed += 1;
        console.error(`✗ ${test.name}`);
        console.error(error);
      }
    }
  }
} finally {
  await server.close();
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`\nAll tests passed (${pathToFileURL(testRoot).href})`);
}
