# Contributing to custom-github-actions

The project structure is simple and intuitive, designed to facilitate easy contributions. Each reusable GitHub Action is located in its own directory, with a README file explaining its purpose and usage.

## Contributing Changes

When you are ready to contribute your changes, follow these steps:
1. **Commit Your Changes**:
   ```sh
   git commit -m "feat: Add new feature"
   ```
2. **Push to Your Fork**:
   ```sh
   git push origin feature/my-new-feature
   ```
3. **Create a tag of the release**:
   When someone references reusable GitHub Action in their workflow, they should use a tag or commit sha to ensure that the action will not change unexpectedly. To create a tag, run:
   ```sh
   git tag v1 # Replace with the appropriate version number
   git push origin v1
   ```
   This can be referenced in the workflow file as follows:
   ```yaml
   uses: ukorvl/custom-github-actions/check-version-changelog@v1
   ```
4. **Open a Pull Request**:
   - Go to the original repository.
   - Click "New Pull Request".
   - Select your branch and submit the PR with a clear description.
5. **Release**:
   Push your created tag to the main branch of the repository. This will trigger the release workflow, which will create a new release on GitHub with the specified tag.

## Issues and Feature Requests
Use the [**GitHub Issues**](https://github.com/ukorvl/custom-github-actions/issues) tab to report bugs and request features.
