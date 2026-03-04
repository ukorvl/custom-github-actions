/**
 * This script checks that production dependencies in target npm packages
 * use only approved licenses.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_APPROVED = [
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
  "Unlicense",
];

const DEFAULT_IGNORED_DIRS = ["node_modules", ".git"];

function parseDelimitedList(value) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];

  const matches = text.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map(token => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function parseTriStateMode(value, name) {
  const mode = String(value ?? "auto").trim().toLowerCase();
  if (mode === "auto" || mode === "") return "auto";
  if (["true", "1", "yes"].includes(mode)) return true;
  if (["false", "0", "no"].includes(mode)) return false;

  throw new Error(`Invalid ${name} value: ${value}`);
}

function parseAutoDiscoverMode(value) {
  const mode = String(value ?? "auto").trim().toLowerCase();
  if (mode === "" || mode === "auto") return "auto";
  if (["root", "manifests", "all"].includes(mode)) return mode;

  throw new Error(`Invalid AUTO_DISCOVER value: ${value}`);
}

function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function hasPackageJson(dirPath) {
  return fs.existsSync(path.join(dirPath, "package.json"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePattern(rawPattern) {
  return rawPattern.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function listSubdirs(dirPath, ignoredNames) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(entry => entry.isDirectory() && !ignoredNames.has(entry.name))
    .map(entry => path.join(dirPath, entry.name));
}

function escapeRegex(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function makeSegmentRegex(segment) {
  let source = "";
  for (const char of segment) {
    if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(char);
    }
  }

  return new RegExp(`^${source}$`);
}

function hasGlobMagic(segment) {
  return segment.includes("*") || segment.includes("?");
}

function expandPackagePattern(rootDir, pattern, ignoredNames) {
  const normalized = normalizePattern(pattern);
  if (!normalized) return [];

  if (!normalized.includes("*") && !normalized.includes("?")) {
    const direct = path.resolve(rootDir, normalized);
    return hasPackageJson(direct) ? [direct] : [];
  }

  const segments = normalized.split("/").filter(Boolean);
  const found = new Set();

  function walk(current, index) {
    if (!isDirectory(current)) return;

    if (index >= segments.length) {
      if (hasPackageJson(current)) {
        found.add(path.resolve(current));
      }
      return;
    }

    const segment = segments[index];
    if (segment === "**") {
      walk(current, index + 1);
      for (const subdir of listSubdirs(current, ignoredNames)) {
        walk(subdir, index);
      }
      return;
    }

    if (!hasGlobMagic(segment)) {
      walk(path.join(current, segment), index + 1);
      return;
    }

    const matcher = makeSegmentRegex(segment);
    for (const subdir of listSubdirs(current, ignoredNames)) {
      if (matcher.test(path.basename(subdir))) {
        walk(subdir, index + 1);
      }
    }
  }

  walk(path.resolve(rootDir), 0);
  return [...found];
}

function findAllPackageDirs(rootDir, ignoredNames) {
  const root = path.resolve(rootDir);
  const found = new Set();
  const queue = [root];
  let index = 0;

  while (index < queue.length) {
    const current = queue[index];
    index += 1;
    if (!isDirectory(current)) continue;

    if (hasPackageJson(current)) {
      found.add(path.resolve(current));
    }

    for (const subdir of listSubdirs(current, ignoredNames)) {
      queue.push(subdir);
    }
  }

  return [...found];
}

function loadManifestPatterns(rootDir) {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = readJson(packageJsonPath);
    const workspaces = packageJson.workspaces;

    if (Array.isArray(workspaces)) return workspaces;
    if (workspaces && Array.isArray(workspaces.packages)) return workspaces.packages;
  }

  return loadPnpmWorkspacePatterns(rootDir);
}

function loadPnpmWorkspacePatterns(rootDir) {
  const pnpmWorkspacePath = path.join(rootDir, "pnpm-workspace.yaml");
  if (!fs.existsSync(pnpmWorkspacePath)) return [];

  const lines = fs.readFileSync(pnpmWorkspacePath, "utf8").split(/\r?\n/);
  const patterns = [];
  let insidePackages = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!insidePackages) {
      if (/^packages\s*:/.test(trimmed)) {
        insidePackages = true;
      }
      continue;
    }

    if (/^[A-Za-z0-9_-]+\s*:/.test(trimmed) && !trimmed.startsWith("-")) {
      break;
    }

    const match = trimmed.match(/^-\s*(.+)\s*$/);
    if (!match) continue;

    const raw = match[1].trim();
    const unquoted = raw.replace(/^['"]/, "").replace(/['"]$/, "").trim();
    if (unquoted) patterns.push(unquoted);
  }

  return patterns;
}

function resolvePackageDirs(rootDir, packagePathsInput, packageGlobsInput, autoMode, ignoredNames) {
  const explicitPaths = parseDelimitedList(packagePathsInput);
  if (explicitPaths.length > 0) {
    const resolved = explicitPaths.map(raw => {
      if (path.isAbsolute(raw)) return path.resolve(raw);
      return path.resolve(rootDir, raw);
    });

    const missing = resolved.filter(dir => !hasPackageJson(dir));
    if (missing.length > 0) {
      throw new Error(`PACKAGE_PATHS contains directories without package.json: ${missing.join(", ")}`);
    }

    return [...new Set(resolved)];
  }

  const patternsInput = parseDelimitedList(packageGlobsInput);
  if (patternsInput.length > 0) {
    const dirs = patternsInput.flatMap(pattern => expandPackagePattern(rootDir, pattern, ignoredNames));
    return [...new Set(dirs)];
  }

  if (autoMode === "root") {
    return hasPackageJson(rootDir) ? [path.resolve(rootDir)] : [];
  }

  if (autoMode === "all") {
    return findAllPackageDirs(rootDir, ignoredNames);
  }

  const manifestPatterns = loadManifestPatterns(rootDir);
  if (autoMode === "manifests") {
    const dirs = manifestPatterns.flatMap(pattern =>
      expandPackagePattern(rootDir, pattern, ignoredNames)
    );
    return [...new Set(dirs)];
  }

  if (manifestPatterns.length > 0) {
    const dirs = manifestPatterns.flatMap(pattern =>
      expandPackagePattern(rootDir, pattern, ignoredNames)
    );
    return [...new Set(dirs)];
  }

  if (hasPackageJson(rootDir)) {
    return [path.resolve(rootDir)];
  }

  return findAllPackageDirs(rootDir, ignoredNames);
}

function applyRootInclusion(targetDirs, rootDir, includeRootMode) {
  const resolvedRoot = path.resolve(rootDir);
  const hasRootPackage = hasPackageJson(resolvedRoot);
  const dirs = [...targetDirs];

  if (includeRootMode === true) {
    if (!hasRootPackage) {
      throw new Error(`ROOT_DIR does not contain package.json: ${resolvedRoot}`);
    }
    dirs.push(resolvedRoot);
  }

  if (includeRootMode === false) {
    return dirs.filter(dir => path.resolve(dir) !== resolvedRoot);
  }

  return dirs;
}

function getLocalPackageNames(dirs) {
  const names = new Set();

  for (const dir of dirs) {
    const packageJsonPath = path.join(dir, "package.json");
    if (!fs.existsSync(packageJsonPath)) continue;

    const packageJson = readJson(packageJsonPath);
    if (packageJson.name) {
      names.add(packageJson.name);
    }
  }

  return names;
}

function parsePkgNameFromKey(key) {
  if (key.startsWith("@")) {
    const secondAt = key.indexOf("@", 1);
    if (secondAt === -1) return key;
    return key.slice(0, secondAt);
  }

  const at = key.lastIndexOf("@");
  return at > 0 ? key.slice(0, at) : key;
}

function checkOnePackageDir({ cwd, label, localPackageNames, approved, excluded, checkerBin, checkerArgs }) {
  const args = ["--yes", checkerBin, ...checkerArgs];

  const output = execFileSync("npx", args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  }).toString();

  const data = JSON.parse(output);
  const violations = [];

  for (const [key, info] of Object.entries(data)) {
    const pkgName = parsePkgNameFromKey(key);
    if (localPackageNames.has(pkgName) || excluded.has(pkgName)) {
      continue;
    }

    const rawLicenses = info && typeof info === "object" ? info.licenses : undefined;
    const licenses = Array.isArray(rawLicenses) ? rawLicenses : [rawLicenses];

    const allowed = licenses.some(license => approved.has(String(license)));
    if (!allowed) {
      violations.push({ pkg: key, license: rawLicenses });
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `[licenses] ${label} has non-approved third-party licenses:\n` +
        violations.map(v => `  - ${v.pkg}: ${String(v.license)}`).join("\n")
    );
  }
}

function main() {
  const rootDir = path.resolve(process.env.ROOT_DIR || ".");
  const autoDiscoverMode = parseAutoDiscoverMode(process.env.AUTO_DISCOVER);
  const includeRootMode = parseTriStateMode(
    process.env.INCLUDE_ROOT_PACKAGE ?? process.env.CHECK_ROOT_PACKAGE,
    "INCLUDE_ROOT_PACKAGE"
  );

  const ignoredFromInput = parseDelimitedList(process.env.IGNORE_DIR_NAMES);
  const ignoredNames = new Set(ignoredFromInput.length > 0 ? ignoredFromInput : DEFAULT_IGNORED_DIRS);

  const packagePathsInput = process.env.PACKAGE_PATHS ?? process.env.WORKSPACE_PATHS;
  const packageGlobsInput = process.env.PACKAGE_GLOBS ?? process.env.WORKSPACE_GLOBS;

  let targetDirs = resolvePackageDirs(
    rootDir,
    packagePathsInput,
    packageGlobsInput,
    autoDiscoverMode,
    ignoredNames
  );

  targetDirs = applyRootInclusion(targetDirs, rootDir, includeRootMode);

  const dedupedTargetDirs = [...new Set(targetDirs.map(dir => path.resolve(dir)))];
  if (dedupedTargetDirs.length === 0) {
    throw new Error(
      "No package directories to check. Set PACKAGE_PATHS/PACKAGE_GLOBS, or adjust AUTO_DISCOVER/INCLUDE_ROOT_PACKAGE."
    );
  }

  const localPackageNames = getLocalPackageNames(dedupedTargetDirs);
  const excludedNames = new Set(parseDelimitedList(process.env.EXCLUDE_PACKAGE_NAMES));

  const approvedFromInput = parseDelimitedList(process.env.APPROVED_LICENSES);
  const approved = new Set(approvedFromInput.length > 0 ? approvedFromInput : DEFAULT_APPROVED);

  if (approved.size === 0) {
    throw new Error("APPROVED_LICENSES is empty");
  }

  const checkerBin = String(process.env.LICENSE_CHECKER_BIN || "license-checker-rseidelsohn").trim();
  if (!checkerBin) {
    throw new Error("LICENSE_CHECKER_BIN is empty");
  }

  const checkerArgs = parseArgs(process.env.LICENSE_CHECKER_ARGS || "--production --json");

  console.log(`Checking licenses in ${dedupedTargetDirs.length} package(s)...`);

  for (const dir of dedupedTargetDirs) {
    const packageJsonPath = path.join(dir, "package.json");
    const packageJson = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath) : {};
    const label = packageJson.name || path.relative(rootDir, dir) || dir;

    console.log(`- ${label}`);
    checkOnePackageDir({
      cwd: dir,
      label,
      localPackageNames,
      approved,
      excluded: excludedNames,
      checkerBin,
      checkerArgs,
    });
  }

  console.log("All checked dependencies use approved licenses.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
