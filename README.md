# GitHub Action: Versioning

This GitHub Action automates the versioning process for pull requests in a repository. It checks for specific labels on the pull request to determine whether to increment the version as major, minor, or patch. If a version change is necessary, it updates the `package.json` file in the repository with the new version.

## How It Works

1. **Token Retrieval**: The action retrieves the GitHub token from the action inputs.
2. **Pull Request Check**: It checks if the action is triggered by a pull request.
3. **Label Fetching**: The action fetches existing labels from the pull request.
4. **Version Increment Logic**: Based on the labels, it determines the type of version increment:
   - **Major**: If a label from the major labels list is found, the major version is incremented.
   - **Minor**: If a label from the minor labels list is found, the minor version is incremented.
   - **Patch**: If a label from the patch labels list is found, the patch version is incremented.
5. **Version Update**: If a version change is detected, it updates the `package.json` file with the new version.
6. **Commit Changes**: The action commits the changes back to the repository if the `skip-commit` input is not set to true.
7. **Tag Creation**: Optionally, it can create a tag for the new version based on the `create-tag` input.

## Inputs

| Input          | Required | Default Value  | Description                                                              |
| -------------- | -------- | -------------- | ------------------------------------------------------------------------ |
| `github-token` | Yes      | N/A            | The GitHub token for authentication.                                     |
| `pr-number`    | No       | N/A            | The pull request number to check.                                        |
| `labels-minor` | No       | N/A            | A comma-separated list of labels that trigger a minor version increment. |
| `labels-major` | No       | N/A            | A comma-separated list of labels that trigger a major version increment. |
| `labels-patch` | No       | N/A            | A comma-separated list of labels that trigger a patch version increment. |
| `skip-commit`  | No       | false          | If set to true, the action will skip committing changes.                 |
| `create-tag`   | No       | false          | If set to true, the action will create a tag for the new version.        |
| `path`         | No       | `package.json` | The path to the `package.json` file (default is `package.json`).         |

## Example Usage
