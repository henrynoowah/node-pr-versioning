"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const fs_1 = require("fs");
async function run() {
    const token = (0, core_1.getInput)("gh-token");
    const label = (0, core_1.getInput)("label");
    const minorLabel = (0, core_1.getInput)("minor-label");
    const majorLabel = (0, core_1.getInput)("major-label");
    const patchLabel = (0, core_1.getInput)("patch-label");
    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, "utf-8"));
    const version = packageJson.version;
    console.log(version);
    const octokit = (0, github_1.getOctokit)(token);
    const pullRequest = github_1.context.payload.pull_request;
    try {
        if (!pullRequest) {
            (0, core_1.setFailed)("This action should only be run on a pull request");
            return;
        }
        await octokit.rest.issues.addLabels({
            owner: github_1.context.repo.owner,
            repo: github_1.context.repo.repo,
            issue_number: pullRequest.number,
            labels: [label],
        });
    }
    catch (error) {
        (0, core_1.setFailed)(error.message);
    }
}
run();
