import { Octokit } from "@octokit/rest";

let octokit = null;

export const getOctokit = () => {
  if (octokit === null) {
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }
  return octokit;
};
