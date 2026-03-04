# check-npm-licenses

A composite GitHub Action that checks production dependency licenses and fails when a dependency uses a non-approved license.

This action is package-centric and works for both single-package repos and multi-package repos.

## Inputs

| Name | Description | Default |
|---|---|---|
| `ROOT_DIR` | Project root directory | `.` |
| `PACKAGE_PATHS` | Explicit package directories to check (comma/newline separated, relative to `ROOT_DIR`) | `""` |
| `PACKAGE_GLOBS` | Glob patterns for package directories (comma/newline separated), used when `PACKAGE_PATHS` is empty | `""` |
| `AUTO_DISCOVER` | Discovery mode when explicit paths/globs are not provided: `auto`, `root`, `manifests`, `all` | `auto` |
| `INCLUDE_ROOT_PACKAGE` | Include root package if `package.json` exists: `auto`, `true`, `false` | `auto` |
| `IGNORE_DIR_NAMES` | Directory names ignored during glob/recursive discovery (comma/newline separated) | `node_modules`, `.git` |
| `APPROVED_LICENSES` | Approved license IDs (comma/newline separated) | `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `CC0-1.0`, `ISC`, `MIT`, `Unlicense` |
| `EXCLUDE_PACKAGE_NAMES` | Package names to ignore (comma/newline separated) | `""` |
| `LICENSE_CHECKER_BIN` | Binary/package executed by `npx` | `license-checker-rseidelsohn` |
| `LICENSE_CHECKER_ARGS` | Extra args passed to license checker | `--production --json` |

## Discovery behavior

- `PACKAGE_PATHS` is used first when provided.
- Else `PACKAGE_GLOBS` is used.
- Else `AUTO_DISCOVER` decides:
  - `auto`: try manifest-based package patterns first; if unavailable, check root package; if root has no `package.json`, scan recursively.
  - `root`: check only `ROOT_DIR`.
  - `manifests`: detect package dirs from common monorepo manifests.
  - `all`: recursively find every directory containing `package.json`.

## Example usage

### Default (single-package friendly)

```yaml
- uses: ukorvl/custom-github-actions/check-npm-licenses@v1
```

### Explicit package directories

```yaml
- uses: ukorvl/custom-github-actions/check-npm-licenses@v1
  with:
    ROOT_DIR: .
    PACKAGE_PATHS: |
      packages/web
      packages/api
```

### Custom policy

```yaml
- uses: ukorvl/custom-github-actions/check-npm-licenses@v1
  with:
    AUTO_DISCOVER: all
    INCLUDE_ROOT_PACKAGE: false
    APPROVED_LICENSES: |
      MIT
      Apache-2.0
      BSD-3-Clause
    EXCLUDE_PACKAGE_NAMES: |
      @my-org/internal-shared
```

## Notes

- The action requires Node.js and npm on the runner.
- `LICENSE_CHECKER_ARGS` is parsed as shell-like tokens; use quotes when a single argument contains spaces.
