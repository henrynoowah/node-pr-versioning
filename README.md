# GitHub Action: Node PR Versioning

This GitHub Action automates the versioning process for pull requests in a repository. It checks for specific labels on the pull request to determine whether to increment the version as major, minor, or patch. If a version change is necessary, it updates the `package.json` file in the repository with the new version.

The action will make a commit to the

## How It Works

1. **Token Retrieval**: The action retrieves the GitHub token from the action inputs. Use `PAT` if you are committing to a protected branch.
2. **Pull Request Check**: It checks if the action is triggered by a pull request.
3. **Label Fetching**: The action fetches existing labels from the pull request.
4. **Version Increment Logic**: Based on the labels, it determines the type of version increment:
   - **Major**: If a label from the major labels list is found, the major version is incremented.
   - **Minor**: If a label from the minor labels list is found, the minor version is incremented.
   - **Patch**: If a label from the patch labels list is found, the patch version is incremented.
5. **Version Update**: If a version change is detected, it updates the `package.json` file with the new version.
6. **Commit Changes**: The action commits the changes back to the repository if the `skip-commit` input is not set to true.
7. **Tag Creation**: Optionally, it can create a tag for the new version based on the `create-tag` input.
8. **Path**: Optionally, it can specify the path to the `package.json` file to be updated.
9. **Dry Run**: Optionally, it can run in dry run mode to check if the version will be updated without actually committing the changes.

## Inputs

| Input            | Required | Default Value                                        | Description                                                                                        |
| ---------------- | -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `github-token`   | ✅       | N/A                                                  | The GitHub token for authentication.                                                               |
| `labels-minor`   | ✅       | N/A                                                  | A comma-separated list of labels that trigger a minor version increment.                           |
| `labels-major`   | ✅       | N/A                                                  | A comma-separated list of labels that trigger a major version increment.                           |
| `labels-patch`   | ✅       | N/A                                                  | A comma-separated list of labels that trigger a patch version increment.                           |
| `commit-message` | ❌       | chore: version update {{version}} -> {{new-version}} | The commit message. `{{version}}` is the current version and `{{new-version}}` is the new version. |
| `pr-number`      | ❌       | N/A                                                  | The pull request number to check (optional: when using push event).                                |
| `skip-commit`    | ❌       | false                                                | If set to true, the action will skip committing changes.                                           |
| `create-tag`     | ❌       | false                                                | If set to true, the action will create a tag for the new version.                                  |
| `tag-name`       | ❌       | `v{{new-version}}`                                   | The name for the tag. `{{new-version}}` is the new version returned by the action.                 |
| `path`           | ❌       | `package.json`                                       | The path to the `package.json` file (default is `package.json`).                                   |
| `dry-run`        | ❌       | false                                                | If set to true, the action will not commit changes.                                                |

## Outputs

| Output        | Description                                     |
| ------------- | ----------------------------------------------- |
| `new-version` | The new version returned by the action.         |
| `pr-number`   | The number of pull request used for the action. |

## Example Usage

### Basics

```yaml
name: "Run on pull request merged"

on:
  pull_request:

jobs:
  update-version:
    runs-on: "ubuntu-latest"
    steps:
      - uses: "actions/checkout@v4"
      - uses: "henrynoowah/node-pr-versioning@v1.0.0"
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labels-minor: "enhancement"
          labels-major: "major"
          labels-patch: "chore, bug"
```

### Commit bumped version on pull request merged

```yaml
name: "Run on pull request merged"

on:
  pull_request:
    types: [closed]

jobs:
  update-version:
    runs-on: "ubuntu-latest"
    if: github.event.pull_request.merged == true
    steps:
      - uses: "actions/checkout@v4"
      - uses: "henrynoowah/node-pr-versioning@v1.0.0"
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labels-minor: "enhancement"
          labels-major: "major"
          labels-patch: "chore, bug"
```

### Creating a tag on push

- Because the `push` event does not have a pull request number, this action is not ideal to be use on push event as pull request number is required.
- However, we can get the PR number from the commit message. by using `git log -1 --pretty=%B` to get the commit message and then use `grep -oP '#\K[0-9]+'` to get the PR number.

```yaml
name: "Run on pull request merged"

on:
  push:
    branches: [dev]

jobs:
  update-version:
    runs-on: "ubuntu-latest"
    steps:
      - uses: "actions/checkout@v4"
      - name: "Get PR number"
        id: pr
        run: |
          PR_NUMBER=$(git log -1 --pretty=%B | grep -oP '#\K[0-9]+' || echo '')
          echo "PR_NUMBER=$PR_NUMBER"
          echo "number=$PR_NUMBER" >> $GITHUB_OUTPUT
      - uses: "henrynoowah/node-pr-versioning@v1.0.0"
        if: ${{ steps.pr.outputs.number != '' }}
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labels-minor: "enhancement"
          labels-major: "major"
          labels-patch: "chore, bug"
          create-tag: true
          tag-name: "v{{version}}"
```

---

## Monorepo

Example usage in a monorepo setup:

- Because monorepo has multiple `package.json` files and if you are to manage each project version, you need to specify the path to the `package.json` file to be updated.
- Filter the paths to be updated by using `paths-filter` action like `dorny/paths-filter` together.
- Then use the `noowah/pr-versioning` action to update the version.
- By using tag-name, you can specify the tag name for each project.

```yaml
name: "Test Monorepo"

on:
  pull_request:
    branches: [main, dev]
    types: [opened, reopened, synchronize]

jobs:
  update-version:
    runs-on: "ubuntu-latest"
    steps:
      - uses: "actions/checkout@v4"
      - name: "Filter paths"
        uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            admin:
              - 'apps/admin/**'
            client:
              - 'apps/client/**'

      - name: "Update admin version"
        if: steps.filter.outputs.admin == 'true'
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labels-minor: "enhancement"
          labels-major: "major"
          labels-patch: "chore, bug"
          create-tag: true
          skip-commit: true
          path: "apps/admin/**"
          tag-name: "@repo/admin@v{{version}}"
          dry-run: true

      - name: "Update client version"
        if: steps.filter.outputs.client == 'true'
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          labels-minor: "enhancement"
          labels-major: "major"
          labels-patch: "chore, bug"
          create-tag: true
          skip-commit: true
          tag-name: "@repo/client@v{{version}}"
          dry-run: true
```
