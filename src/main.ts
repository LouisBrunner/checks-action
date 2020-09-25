import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Inputs from './namespaces/Inputs';
import {parseInputs} from './inputs';
import {createRun, updateRun} from './checks';

const isCreation = (inputs: Inputs.Args): inputs is Inputs.ArgsCreate => {
  return !!(inputs as Inputs.ArgsCreate).name;
};

async function run(): Promise<void> {
  try {
    core.debug(`Parsing inputs`);
    const inputs = parseInputs(core.getInput);

    core.debug(`Setting up OctoKit`);
    const octokit = github.getOctokit(inputs.token);

    const ownership = {
      owner: '',
      repo: '',
    };
    let sha = '';

    if (inputs.repo) {
      const repo = inputs.repo.split('/');
      ownership.owner = repo[0];
      ownership.repo = repo[1];
    } else {
      ownership.owner = github.context.repo.owner;
      ownership.repo = github.context.repo.repo;
    }

    if (inputs.sha) {
      sha = inputs.sha;
    } else {
      sha = github.context.sha;
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
