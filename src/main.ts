import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const token: string = core.getInput('token')

    core.debug(`Setting up OctoKit`)
    const octokit = new github.GitHub(token)

    // TODO: finish
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
