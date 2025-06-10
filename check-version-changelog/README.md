# check-version-changelog

A composite GitHub Action that checks if `package.json` version has changed, and ensures that the changelog contains the new version.

## Inputs

| Name           | Description                          | Default            |
|----------------|--------------------------------------|--------------------|
| `PACKAGE_JSON` | Path to your `package.json` file     | `lib/package.json` |
| `CHANGELOG_FILE` | Path to your changelog file        | `lib/CHANGELOG.md` |

## Example usage

```yaml
uses: ukorvl/custom-github-actions/check-version-changelog@v1
with:
  PACKAGE_JSON: "lib/package.json"
  CHANGELOG_FILE: "lib/CHANGELOG.md"
```
