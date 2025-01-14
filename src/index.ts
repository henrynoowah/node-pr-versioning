import { getInput, setFailed, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import fs, { readFileSync } from "fs";
import path from "path";
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

  const minorLabel = getInput("labels-minor")
    .split(",")
    .map((label) => label.trim());
  const majorLabel = getInput("labels-major")
    .split(",")
    .map((label) => label.trim());
  const patchLabel = getInput("labels-patch")
    .split(",")
    .map((label) => label.trim());

  const skipCommit = getInput("skip-commit");
  const createTag = getInput("create-tag");
  const customPath = getInput("path");

  const packageJsonPath = customPath ?? "package.json";

  console.log("packageJsonPath", packageJsonPath);
  const { data: packageJsonResponse } = await octokit.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path: packageJsonPath,
    ref: pullRequest.head.ref,
  });

  const packageJson = Buffer.from(
    (packageJsonResponse as any).content,
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

    const isMajor = existingLabels.some((label) => majorLabel.includes(label));
    const isMinor = existingLabels.some((label) => minorLabel.includes(label));
    const isPatch = existingLabels.some((label) => patchLabel.includes(label));

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

    console.log(`Updating version: ${version} -> ${newVersion}`);
    setOutput("new-version", newVersion);

    if (skipCommit) return;

    // Update package.json with the new version
    // const packageJsonPath = path.join(__dirname, "package.json");

    console.log("packageJsonPath", packageJsonPath);

    const packageJson = JSON.parse(
      await fs.promises.readFile(packageJsonPath, "utf-8")
    );

    packageJson.version = newVersion;
    await fs.promises.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2)
    );

    // Get the current file's SHA
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: "package.json",
      ref: pullRequest.head.ref,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: "package.json",
      message: `node-pr-versioning: Update version from ${version} to ${newVersion}`,
      content: Buffer.from(JSON.stringify(packageJson, null, 2)).toString(
        "base64"
      ),
      branch: pullRequest.head.ref,
      sha: (currentFile as any).sha, // Use the current file's SHA
    });
    if (createTag) {
      await octokit.rest.git.createTag({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag: newVersion,
        message: `node-pr-versioning: Update version from ${version} to ${newVersion}`,
        object: (currentFile as any).sha, // Add the current file's SHA as the object
        type: "commit", // Specify the type as "commit"
      });
    }
  } catch (error) {
    setFailed((error as Error).message);
  }
}

run();
