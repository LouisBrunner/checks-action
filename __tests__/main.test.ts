import * as process from 'process';
import * as cp from 'child_process';
import * as path from 'path';

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['GITHUB_REPOSITORY'] = 'LB/ABC';
  process.env['INPUT_TOKEN'] = 'ABC';
  process.env['INPUT_NAME'] = 'ABC';
  process.env['INPUT_STATUS'] = 'completed';
  process.env['INPUT_CONCLUSION'] = 'success';
  const ip = path.join(__dirname, '..', 'lib', 'main.js');
  const options: cp.ExecSyncOptions = {
    env: process.env,
  };
  try {
    console.log(cp.execSync(`node ${ip}`, options).toString());
  } catch (e) {
    console.log(e.stdout.toString());
    throw e;
  }
});

// TODO: add more
