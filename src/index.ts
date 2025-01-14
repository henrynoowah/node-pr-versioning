// import { getInput, setFailed } from "@actions/core";
// import { context, getOctokit } from "@actions/github";
import { readFileSync } from "fs";

async function run() {
  // const token = getInput("gh-token");
  // const label = getInput("label");

  // const minorLabel = getInput("minor-label");
  // const majorLabel = getInput("major-label");
  // const patchLabel = getInput("patch-label");
  const packageJsonPath = `${process.env.GITHUB_WORKSPACE}/package.json`;
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const version = packageJson.version;

  console.log(`Current version: ${version}`);

  // const octokit = getOctokit(token);

  // const pullRequest = context.payload.pull_request;

  // try {
  //   if (!pullRequest) {
  //     setFailed("This action should only be run on a pull request");
  //     return;
  //   }
  //   await octokit.rest.issues.addLabels({
  //     owner: context.repo.owner,
  //     repo: context.repo.repo,
  //     issue_number: pullRequest.number,
  //     labels: [label],
  //   });
  // } catch (error) {
  //   setFailed((error as Error).message);
  // }
}

run();
