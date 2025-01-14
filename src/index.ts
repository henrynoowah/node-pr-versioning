import { getInput, setFailed, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import fs from "fs";
/**
 * Runs the versioning action for a GitHub pull request.
 *
 * This function retrieves the GitHub token, checks for the presence of a pull request,
 * and fetches the existing labels associated with the pull request. Based on the labels,
 * it determines whether to increment the version as major, minor, or patch. If a version
 * change is necessary, it updates the `package.json` file in the repository with the new version.
 *
 * The function performs the following steps:
 * 1. Retrieves the GitHub token from the action inputs.
 * 2. Checks if the action is triggered by a pull request.
 * 3. Fetches existing labels from the pull request.
 * 4. Determines the type of version increment based on the labels.
 * 5. Updates the `package.json` file with the new version if necessary.
 * 6. Commits the changes back to the repository.
 *
 * @async
 * @function run
 * @throws {Error} Throws an error if the GitHub token is missing or if the action is not run on a pull request.
 */
async function run() {
  const token = getInput("github-token");
  if (!token) return setFailed("GitHub token is required");

  const pullRequest = context.payload.pull_request;

  if (!pullRequest)
    return setFailed("This action should only be run on a pull request");

  const octokit = getOctokit(token);

  const minorLabels = getInput("labels-minor")
    .split(",")
    .map((label) => label.trim());
  const majorLabels = getInput("labels-major")
    .split(",")
    .map((label) => label.trim());
  const patchLabels = getInput("labels-patch")
    .split(",")
    .map((label) => label.trim());

  console.group("🎉 Major Labels:");
  majorLabels.forEach((label) => console.log(`- ${label}`));
  console.groupEnd();
  console.log(); // Empty space

  console.group("🚀 Minor Labels:");
  minorLabels.forEach((label) => console.log(`- ${label}`));
  console.groupEnd();
  console.log(); // Empty space

  console.group("🔧 Patch Labels:");
  patchLabels.forEach((label) => console.log(`- ${label}`));
  console.groupEnd();
  console.log(); // Empty space

  const skipCommit = getInput("skip-commit");
  const createTag = getInput("create-tag");
  const customPath = getInput("path");

  const packageJsonPath = customPath ?? "package.json";

  const { data: currentFile } = await octokit.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: packageJsonPath,
    ref: pullRequest.head.ref,
  });

  const packageJson = Buffer.from(
    (currentFile as any).content,
    "base64"
  ).toString("utf-8");
  const version = JSON.parse(packageJson).version;

  console.log(version);

  try {
    // Fetch existing labels from the pull request
    const { data: pullRequestData } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pullRequest.number,
    });

    const existingLabels = pullRequestData.labels.map((label) => label.name);
    console.group("Existing labels:");
    existingLabels.forEach((label) => console.log(`- ${label}`));
    console.groupEnd();
    console.log(); // Empty space

    const isMajor = existingLabels.some((label) => majorLabels.includes(label));
    const isMinor = existingLabels.some((label) => minorLabels.includes(label));
    const isPatch = existingLabels.some((label) => patchLabels.includes(label));

    let newVersion = version;

    if (isMajor) {
      console.log("🎉 Major label found");
      newVersion = Number(version.split(".")[0]) + 1 + ".0.0";
    }
    if (isMinor) {
      console.log("🚀 Minor label found");
      newVersion =
        version.split(".")[0] +
        "." +
        (Number(version.split(".")[1]) + 1) +
        ".0";
    }
    if (isPatch) {
      console.log("🔧 Patch label found");
      newVersion =
        version.split(".")[0] +
        "." +
        version.split(".")[1] +
        "." +
        (Number(version.split(".")[2]) + 1);
    }

    if (newVersion === version) console.log("No version change detected");

    console.log(`Expected version update: ${version} -> ${newVersion}`);
    setOutput("new-version", newVersion);

    if (skipCommit) {
      console.log("skipping commit");
    } else {
      console.log("packageJsonPath", packageJsonPath);

      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, "utf-8")
      );

      packageJson.version = newVersion;
      await fs.promises.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2)
      );

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: packageJsonPath,
        message: `commit version update: ${version} -> ${newVersion}`,
        content: Buffer.from(JSON.stringify(packageJson, null, 2)).toString(
          "base64"
        ),
        branch: pullRequest.head.ref,
        sha: (currentFile as any).sha, // Use the current file's SHA
      });
    }
    if (createTag) {
      const tagName = skipCommit ? version : newVersion;

      console.log(`Creating Tag: ${tagName}`);
      console.log(); // Empty space

      // Create a reference to the new tag
      await octokit.rest.git.createRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `refs/tags/${tagName}`,
        sha: (currentFile as any).sha,
      });

      console.log(`Tag ${tagName} created successfully`);
    }
  } catch (error) {
    setFailed((error as Error).message);
  }
}

run();
