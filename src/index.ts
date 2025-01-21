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
  // #region Check token
  const token = getInput("github-token");

  if (!token) return setFailed("GitHub token is required");
  // #endregion Check token

  const octokit = getOctokit(token);

  // #region get check & get pr information
  const prNumber = getInput("pr-number");

  let pullRequest;

  if (prNumber) {
    pullRequest = await octokit.rest.pulls
      .get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: Number(prNumber),
      })
      .then((response) => response.data);
  } else {
    pullRequest = context.payload.pull_request;
  }

  if (!pullRequest)
    return setFailed(
      "This action should only be run on a push event or a pull request"
    );
  // #region get check & get pr information

  // #region Pull Request task
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

  // const skipCommitInput = getInput("skip-commit");
  // const skipCommit =
  //   skipCommitInput === "true" ? true : Boolean(skipCommitInput);
  const skipCommit: boolean = Boolean(getInput("skip-commit") === "true");

  // const createTagInput = getInput("create-tag");
  // const createTag = createTagInput === "false" ? true : Boolean(createTagInput);
  const createTag: boolean = Boolean(getInput("create-tag") === "true");

  // const dryRunInput = getInput("dry-run");
  // const dryRun = dryRunInput === "true" ? true : Boolean(dryRunInput);
  const dryRun: boolean = Boolean(getInput("dry-run") === "true");

  const customPath = getInput("path");
  const path = customPath
    ? customPath.replace(/\/\*\*/g, "") + "/package.json"
    : "package.json";

  console.group("\n🔧 Inputs:");
  console.log("- skip-commit:", skipCommit);
  console.log("- create-tag:", createTag);
  console.log("- dry-run:", dryRun);
  console.log("- package.json path:", path);
  console.groupEnd();

  const { data: currentFile } = await octokit.rest.repos.getContent({
    owner: context.repo.owner,
    repo: context.repo.repo,
    path,
    ref: pullRequest.head.ref,
  });

  const packageJson = Buffer.from(
    (currentFile as any).content,
    "base64"
  ).toString("utf-8");
  const version = JSON.parse(packageJson).version;

  try {
    // Fetch existing labels from the pull request
    const { data: pullRequestData } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pullRequest.number,
    });

    const existingLabels = pullRequestData.labels.map((label) => label.name);
    console.group("\nLabels detected:");
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
    } else if (isMinor) {
      console.log("🚀 Minor label found");
      newVersion =
        version.split(".")[0] +
        "." +
        (Number(version.split(".")[1]) + 1) +
        ".0";
    } else if (isPatch) {
      console.log("🔧 Patch label found");
      newVersion =
        version.split(".")[0] +
        "." +
        version.split(".")[1] +
        "." +
        (Number(version.split(".")[2]) + 1);
    }

    if (newVersion === version)
      return console.log("No version change detected");

    setOutput("new-version", newVersion);
    setOutput("pull-request-number", pullRequest.number);

    console.log(`- Expected version bump: ${version} -> ${newVersion}`);

    if (!!dryRun) {
      console.log("\nDry run mode enabled. Skipping actual changes.");
      return;
    }

    if (skipCommit) {
      console.log(`skip commit: ${skipCommit}`);
      console.log(`skipping version bump commit`);
      console.log(); // Empty space
    } else {
      let packageJson;
      try {
        packageJson = JSON.parse(await fs.promises.readFile(path, "utf-8"));
      } catch (error) {
        return setFailed(`Failed to read package.json at path: ${path}`);
      }
      console.log("project found:", packageJson.name);

      packageJson.version = newVersion;
      await fs.promises.writeFile(path, JSON.stringify(packageJson, null, 2));

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path,
        message: `commit version update: ${version} -> ${newVersion}`,
        content: Buffer.from(JSON.stringify(packageJson, null, 2)).toString(
          "base64"
        ),
        branch: pullRequest.base.ref,
        sha: (currentFile as any).sha, // Use the current file's SHA
      });
    }
    if (createTag) {
      console.log(); // Empty space

      const tagPrefix = getInput("tag-prefix");
      const tagName = `${tagPrefix.replace(
        "{{version}}",
        !skipCommit ? newVersion : version
      )}`;
      console.log("- tag-name", tagName);
      console.log(`\nCreating Tag: ${tagName}`);

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
