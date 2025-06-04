import { getOctokit } from "./octokit.mjs";

/**
 * Determines the source and target branches of a workflow.
 *
 * - The target branch is the branch on which the workflow is running.
 * - The source branch is the branch from which the target branch's current state originates,
 *   i.e. the branch that has last been merged.
 *
 * Note that the source branch may not exist or may not be possible to determine and can thus be `null`.
 *
 * @param context The workflow's GitHub context.
 * @returns {Promise<[string|null, string]>} The source and target branch names.
 */
export const findSourceAndTargetBranches = async (context) => {
  const octokit = getOctokit();

  // The branch on which the current workflow is running.
  const targetBranch = context.payload.ref.replace("refs/heads/", "");

  // Fetch the five PRs targeting the current branch that have most recently been closed.
  // We use this to determine the source branch, as there is no built-in way to see
  // if a workflow triggered via push originated from another branch/PR.
  //
  // Note that in theory, this *could* miss our PR as the page size is rather low.
  // However, it is reasonable to assume that we will never merge more than five PRs
  // to the same branch at the same time.
  const pullRequests = await octokit.rest.pulls.list({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: "closed",
    base: targetBranch,
    sort: "updated",
    direction: "desc",
    per_page: 5,
  });

  // Find the PR that has initiated the push resulting in the current state of the branch.
  // We do this by checking if the PR's merge commit is the same as our branch head.
  const mergedPullRequest = pullRequests.data.find((pr) => pr.merge_commit_sha === context.payload.after);

  // If we haven't found a matching pull request, we assume that this is a "naked" push,
  // without an associated source branch.
  if (mergedPullRequest === undefined) {
    return [null, targetBranch];
  }

  const sourceBranch = mergedPullRequest.head.ref.replace("refs/heads/", "");
  return [sourceBranch, targetBranch];
};
