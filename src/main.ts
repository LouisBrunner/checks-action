import * as core from '@actions/core'
import * as github from '@actions/github'

// eslint-disable-next-line @typescript-eslint/require-await
async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')

    core.debug(`Setting up OctoKit`)
    const octokit = new github.GitHub(token)

    const checkRuns = octokit.checks.listForRef({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      ref: github.context.sha,
    })
    core.info(JSON.stringify(checkRuns))

    // TODO: finish
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
