# GitHub Actions: `checks-action` ![build-test](https://github.com/LouisBrunner/checks-action/workflows/build-test/badge.svg)

This GitHub Action allows you to create [Check Runs](https://developer.github.com/v3/checks/runs/#create-a-check-run) directly from your GitHub Action workflow. While each job of a workflow already creates a Check Run, this Action allows to include `annotations`, `images`, `actions` or any other parameters supported by the [Check Runs API](https://developer.github.com/v3/checks/runs/#parameters).

## Usage

The following shows how to publish a Check Run which will have the same status as your job and contains the output of another action. This will be shown predominantly in a Pull Request or on the workflow run.

```
name: "build-test"
on: [push]

jobs:
  test_something:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v1
    - uses: actions/create-outputs@v0.0.0-fake
      id: test
    - uses: LouisBrunner/checks-action@v1.6.1
      if: always()
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        name: Test XYZ
        conclusion: ${{ job.status }}
        output: |
          {"summary":"${{ steps.test.outputs.summary }}"}
```

See the [examples workflow](.github/workflows/examples.yml) for more details and examples (and see the [associated runs](https://github.com/LouisBrunner/checks-action/actions?query=workflow%3Aexamples) to see how it will look like).

## Inputs

### `repo`

_Optional_ The target repository (`owner/repo`) on which to manage the check run. Defaults to the current repository.

### `sha`

_Optional_ The SHA of the target commit. Defaults to the current commit.

### `token`

**Required** Your `GITHUB_TOKEN`

### `name`

**Required** for creation, the name of the check to create (mutually exclusive with `check_id`)

### `check_id`

**Required** for update, ID of the check to update (mutually exclusive with `name`)

### `conclusion`

_Optional_ (**Required** if `status` is `completed`, the default) The conclusion of your check, can be either `success`, `failure`, `neutral`, `cancelled`, `timed_out`, `action_required` or `skipped`

### `status`

_Optional_ The status of your check, defaults to `completed`, can be either `queued`, `in_progress`, `completed`

### `action_url`

_Optional_ The URL to call back to when using `action_required` as a `conclusion` of your check or when including `actions`

See [Check Runs API (`action_required`)](https://developer.github.com/v3/checks/runs/#parameters) or [Check Runs API (`actions`)](https://developer.github.com/v3/checks/runs/#actions-object) for more information

Note that this will override `details_url` (see next) when `conclusion` is `action_required` or when `actions` is provided (the two inputs set the same check attribute, `details_url`)

### `details_url`

_Optional_ A URL with more details about your check, can be an third-party website, a preview of the changes to your Github Pages, etc

Note that this will be overridden by `action_url` (see previous) when `conclusion` is `action_required` or when `actions` is provided (the two inputs set the same check attribute, `details_url`)

### `output`

_Optional_ A JSON object (as a string) containing the output of your check, required when using `annotations` or `images`.

Supports the following properties:

 - `title`: _Optional_, title of your check, defaults to `name`
 - `summary`: **Required**, summary of your check
 - `text_description`: _Optional_, a text description of your annotation (if any)

See [Check Runs API](https://developer.github.com/v3/checks/runs/#output-object) for more information

### `output_text_description_file`

_Optional_ Path to a file containing text which should be set as the `text_description` property of `output`'. Can contain plain text or markdown.

Note that this will be ignored if `output` is not provided. When `output` is provided with a text_description, this input will take precedence and override it.

### `annotations`

_Optional_ A JSON array (as a string) containing the annotations of your check, requires `output` to be included.

Supports the same properties with the same types and names as the [Check Runs API](https://developer.github.com/v3/checks/runs/#annotations-object)

### `images`

_Optional_ A JSON array (as a string) containing the images of your check, requires `output` to be included.

Supports the same properties with the same types and names as the [Check Runs API](https://developer.github.com/v3/checks/runs/#images-object)

### `actions`

_Optional_ A JSON array (as a string) containing the actions of your check.

Supports the same properties with the same types and names as the [Check Runs API](https://developer.github.com/v3/checks/runs/#actions-object)

Note that this will override `details_url` as it relies on `action_url` (the two inputs set the same check attribute, `details_url`)

## Outputs

### `check_id`

The ID of the created check, useful to update it in another action (e.g. non-`completed` `status`)

## Issues

 - Action Required conclusion: button doesn't work?
 - Action elements: button doesn't work?
 - Non-completed status: too many arguments required
