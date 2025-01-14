import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { readFileSync } from "fs";

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

    if (isMajor) {
      console.log("Major label found");
    }
    if (isMinor) {
      console.log("Minor label found");
    }
    if (isPatch) {
      console.log("Patch label found");
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
