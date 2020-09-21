import * as core from "@actions/core";
import * as github from "@actions/github";

let githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  core.setFailed("Please add the GITHUB_TOKEN to this action");
  process.exit(1);
}

const pull_number = github.context.payload.pull_request?.number!;

if (pull_number === undefined) {
  core.setFailed("This action must only be run on pull_request events");
  process.exit(1);
}
const octokit = github.getOctokit(githubToken);
const approvedString = core.getInput("approve", { required: true });
const approved =
  approvedString === "true"
    ? true
    : approvedString === "false"
    ? false
    : (() => {
        core.setFailed(
          `The "approve" argument must be either "true" or "false" but was ${JSON.stringify(
            approvedString
          )}`
        );
        process.exit(1);
      })();

async function getLastReviewFromActionsBot() {
  const reviews = await octokit.pulls.listReviews({
    ...github.context.repo,
    pull_number,
    per_page: 100,
  });
  for (const review of [...reviews.data].reverse()) {
    if (review.user.login === "github-actions[bot]") {
      return review;
    }
  }
}

(async () => {
  const pull_number = 1;

  const lastReviewFromActionsBot = await getLastReviewFromActionsBot();
  if (approved) {
    if (
      lastReviewFromActionsBot?.state === "DISMISSED" ||
      lastReviewFromActionsBot === undefined
    ) {
      await octokit.pulls.createReview({
        ...github.context.repo,
        event: "APPROVE",
        pull_number,
      });
    }
  } else if (lastReviewFromActionsBot?.state === "APPROVED") {
    octokit.pulls.dismissReview({
      ...github.context.repo,
      pull_number,
      message:
        "The condition that made this PR approved changed to false, a person must approve this now.",
      review_id: 2,
    });
  }
})().catch((err) => {
  console.error(err);
  core.setFailed(err.message);
});
