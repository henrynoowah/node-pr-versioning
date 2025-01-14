import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import fs, { readFileSync } from "fs";
import path from "path";

async function run() {
  const token = getInput("gh-token");
  const label = getInput("label");

  const minorLabel = getInput("labels-minor")
    .split(",")
    .map((label) => label.trim());
  const majorLabel = getInput("labels-major")
    .split(",")
    .map((label) => label.trim());
  const patchLabel = getInput("labels-patch")
    .split(",")
    .map((label) => label.trim());

  const packageJsonPath = `${process.cwd()}/package.json`;
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const version = packageJson.version;

  console.log(version);

  const octokit = getOctokit(token);

  const pullRequest = context.payload.pull_request;

  try {
    if (!pullRequest) {
      setFailed("This action should only be run on a pull request");
      return;
    }

    // Fetch existing labels from the pull request
    const { data: pullRequestData } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pullRequest.number,
    });

    const existingLabels = pullRequestData.labels.map((label) => label.name);
    console.group("Existing labels:");
    existingLabels.forEach((label) => console.log(label));
    console.groupEnd();

    const isMajor = existingLabels.some((label) => majorLabel.includes(label));
    const isMinor = existingLabels.some((label) => minorLabel.includes(label));
    const isPatch = existingLabels.some((label) => patchLabel.includes(label));

    let newVersion = version;

    if (isMajor) {
      console.log("🎉 Major label found");

      newVersion = Number(version.split(".")[0]) + 1 + ".0.0";

      console.log(`Updating version: ${version} -> ${newVersion}`);
    }
    if (isMinor) {
      console.log("🚀 Minor label found");
      const newVersion =
        version.split(".")[0] +
        "." +
        (Number(version.split(".")[1]) + 1) +
        ".0";
      console.log(`Updating version: ${version} -> ${newVersion}`);
    }
    if (isPatch) {
      console.log("🔧 Patch label found");
      newVersion =
        version.split(".")[0] +
        "." +
        version.split(".")[1] +
        "." +
        (Number(version.split(".")[2]) + 1);
      console.log(`Updating version: ${version} -> ${newVersion}`);
    }

    if (newVersion !== version) {
      // Update package.json with the new version
      const packageJsonPath = path.join(__dirname, "package.json");
      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, "utf-8")
      );
      packageJson.version = newVersion;
      await fs.promises.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2)
      );

      // Commit the changes to the target branch
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: "package.json",
        message: `Update version from ${version} to ${newVersion}`,
        content: Buffer.from(JSON.stringify(packageJson, null, 2)).toString(
          "base64"
        ),
        branch: context.ref.split("/").pop(), // Assuming the target branch is the current ref
      });
    }

    // Add the new label
    await octokit.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullRequest.number,
      labels: [label],
    });
  } catch (error) {
    setFailed((error as Error).message);
  }
}

run();
