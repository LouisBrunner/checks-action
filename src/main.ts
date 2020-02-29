import * as core from '@actions/core'
import * as github from '@actions/github'

// eslint-disable-next-line @typescript-eslint/require-await
async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')

    core.debug(`Setting up OctoKit`)
    const octokit = new github.GitHub(token)

    const ownership = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    }

    const info = { // TODO: from argument
    }

    const { data } = await octokit.checks.listForRef({
      ...ownership,
      ref: github.context.sha,
    })

    if (data.check_runs.length > 0) {
      octokit.checks.update({
        ...ownership,
        check_run_id: data.check_runs[0].id,
        ...info,
      })
    } else {
      octokit.checks.create({
        ...ownership,
        head_sha: github.context.sha,
        name: 'Check Run Test', // TODO: from argument
        ...info,
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
