import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Inputs from './namespaces/Inputs';
import * as GitHub from './namespaces/GitHub';
import {parseInputs} from './inputs';
import {createRun, updateRun} from './checks';

const isCreation = (inputs: Inputs.Args): inputs is Inputs.ArgsCreate => {
  return !!(inputs as Inputs.ArgsCreate).name;
};

// prettier-ignore
const prEvents = [
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
];

const getSHA = (inputSHA: string | undefined): string => {
  let sha = github.context.sha;
  if (prEvents.includes(github.context.eventName)) {
    const pull = github.context.payload.pull_request as GitHub.PullRequest;
    if (pull?.head.sha) {
      sha = pull?.head.sha;
    }
  }
  if (inputSHA) {
    sha = inputSHA;
  }
  return sha;
};

async function run(): Promise<void> {
  try {
    core.debug(`Parsing inputs`);
    const inputs = parseInputs(core.getInput);

    core.debug(`Setting up OctoKit`);
    const octokit = github.getOctokit(inputs.token);

    const ownership = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    };
    const sha = getSHA(inputs.sha);

    if (inputs.repo) {
      const repo = inputs.repo.split('/');
      ownership.owner = repo[0];
      ownership.repo = repo[1];
    }

    if (isCreation(inputs)) {
      core.debug(`Creating a new Run on ${ownership.owner}/${ownership.repo}@${sha}`);
      const id = await createRun(octokit, inputs.name, sha, ownership, inputs);
      core.setOutput('check_id', id);
    } else {
      const id = inputs.checkID;
      core.debug(`Updating a Run on ${ownership.owner}/${ownership.repo}@${sha} (${id})`);
      await updateRun(octokit, id, ownership, inputs);
    }
    core.debug(`Done`);
  } catch (e) {
    const error = e as Error;
    core.debug(error.toString());
    core.setFailed(error.message);
  }
}

void run();
