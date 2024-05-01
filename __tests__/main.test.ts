import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';

export enum Conclusion {
  Success = 'success',
  Failure = 'failure',
  Neutral = 'neutral',
  Cancelled = 'cancelled',
  TimedOut = 'timed_out',
  ActionRequired = 'action_required',
  Skipped = 'skipped',
}

export enum Status {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
}

type ErrorWithStdout = Error & {stdout: Buffer | string};

// A spawnSync which is actually usable
const actualSpawnSync = async (
  command: string,
  args: string[],
  options: cp.ExecSyncOptions,
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    let replied = false;

    const node = cp.spawn(command, args, options);

    if (node.stdout === null) {
      reject(new Error('stdout is null'));
      return;
    }

    let stdout = '';

    node.on('error', (err: ErrorWithStdout) => {
      if (stdout !== '') {
        err.stdout = stdout;
      }
      reject(err);
      replied = true;
    });

    node.on('exit', (code, signal) => {
      if (replied) {
        return;
      }

      let err: ErrorWithStdout | undefined;
      if (signal !== null) {
        err = new Error(`Action failed with signal: ${signal}`) as ErrorWithStdout;
      } else if (code !== 0) {
        err = new Error(`Action failed with code: ${code}`) as ErrorWithStdout;
      }

      if (err !== undefined) {
        if (stdout !== '') {
          err.stdout = stdout;
        }
        reject(err);
        replied = true;
      }
    });

    node.stdout.on('data', data => {
      stdout += data;
    });

    node.on('close', () => {
      if (replied) {
        return;
      }

      resolve(stdout);
      replied = true;
    });
  });
};

describe('run action', () => {
  const mockEventFile = async (
    event: Record<string, unknown>,
    scope: (filename: string) => Promise<void>,
  ): Promise<void> => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-actions-'));
    const filename = path.join(directory, 'github_event.json');
    fs.writeFileSync(filename, JSON.stringify(event));
    try {
      await scope(filename);
    } finally {
      fs.unlinkSync(filename);
      fs.rmdirSync(directory);
    }
  };

  type RequestHandler = (
    method: string | undefined,
    url: string | undefined,
    headers: http.IncomingHttpHeaders,
    body: Record<string, unknown> | undefined,
  ) => {status: number; headers: Record<string, string>; reply: Record<string, unknown>};

  const mockHTTPServer = async (
    handler: RequestHandler,
    scope: (port: string) => Promise<void>,
  ): Promise<void> => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        console.debug('request', req.method, req.url, req.headers, body);
        const {status, headers, reply} = handler(
          req.method,
          req.url,
          req.headers,
          body !== '' ? (JSON.parse(body) as Record<string, unknown>) : undefined,
        );
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        res.statusCode = status;
        res.end(JSON.stringify(reply));
      });
    });

    const portPromise = new Promise<string>((resolve, reject) => {
      const handle = setTimeout(() => {
        reject(new Error('Timeout while starting mock HTTP server'));
      }, 1000);

      server.listen(0, 'localhost', () => {
        clearTimeout(handle);

        let port = 'INVALID';
        const address = server.address();
        if (address !== null) {
          if (typeof address === 'string') {
            port = address;
          } else {
            port = address.port.toString();
          }
        }

        resolve(port);
      });
    });

    try {
      await scope(await portPromise);
    } finally {
      server.close();
    }
  };

  const parseOutput = (
    output: string,
  ): {error: string | undefined; checkID: number | undefined; output: string} => {
    let error;
    let checkID;
    for (const line of output.split('\n')) {
      if (line.startsWith('::error::')) {
        error = line.split('::error::')[1];
      }
      if (line.startsWith('::set-output name=check_id::')) {
        checkID = parseInt(line.split('::set-output name=check_id::')[1]);
      }
    }
    return {error, checkID, output};
  };

  const runAction = async ({
    repo,
    sha,
    token = 'ABC',
    name,
    id,
    eventName,
    eventPath,
    status,
    conclusion,
    testPort,
  }: {
    repo: string | undefined;
    sha: string | undefined;
    token: string | undefined;
    id: string | undefined;
    name: string | undefined;
    eventName: string | undefined;
    eventPath: string | undefined;
    status: string;
    conclusion: string;
    testPort: string;
  }): Promise<{error: string | undefined; checkID: number | undefined; output: string}> => {
    const entry = path.join(__dirname, '..', 'lib', 'main.js');
    const optional: Record<string, unknown> = {};
    if (repo !== undefined) {
      optional['INPUT_REPO'] = repo;
    }
    if (sha !== undefined) {
      optional['INPUT_SHA'] = sha;
    }
    if (name !== undefined) {
      optional['INPUT_NAME'] = name;
    }
    if (id !== undefined) {
      optional['INPUT_CHECK_ID'] = id;
    }
    if (eventName !== undefined) {
      optional['GITHUB_EVENT_NAME'] = eventName;
    }
    if (eventPath !== undefined) {
      optional['GITHUB_EVENT_PATH'] = eventPath;
    }
    const options: cp.ExecSyncOptions = {
      env: {
        PATH: process.env.PATH,
        GITHUB_REPOSITORY: 'LB/ABC',
        GITHUB_SHA: 'SHA1',
        INPUT_TOKEN: token,
        INPUT_STATUS: status,
        INPUT_CONCLUSION: conclusion,
        ...optional,
        GITHUB_OUTPUT: '',
        INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT: testPort,
      },
      timeout: 1500,
    };
    try {
      const actionOutput = await actualSpawnSync('node', [entry], options);
      return parseOutput(actionOutput);
    } catch (e) {
      const error = e as ErrorWithStdout;
      if (error.stdout === undefined) {
        throw error;
      }
      try {
        return parseOutput(error.stdout.toString());
      } catch {
        throw new Error(
          `Action failed with error: ${error.message} and output: ${error.stdout.toString()}`,
        );
      }
    }
  };

  type LoggedRequest = {
    method: string | undefined;
    url: string | undefined;
    body?: Record<string, unknown>;
  };

  type Case = {
    name: string;
    checkName?: string;
    checkID?: string;
    eventName?: string;
    eventRecord?: Record<string, unknown>;
    repo?: string;
    sha?: string;
    token?: string;
    status: Status;
    conclusion: Conclusion;
    expectedError?: string;
    expectedRequests?: Array<LoggedRequest>;
    expectedCheckID?: number;
  };

  const cases = ((): Case[] => {
    return [
      {
        name: 'creation',
        checkName: 'testo',
        status: Status.Completed,
        conclusion: Conclusion.Success,
        expectedRequests: [
          {
            method: 'POST',
            url: '/repos/LB/ABC/check-runs',
            body: {
              conclusion: 'success',
              head_sha: 'SHA1',
              name: 'testo',
              status: 'completed',
            },
          },
        ],
        expectedCheckID: 456,
      },
      {
        name: 'update',
        checkID: '123',
        status: Status.Completed,
        conclusion: Conclusion.Success,
        expectedRequests: [
          {
            method: 'GET',
            url: '/repos/LB/ABC/check-runs/123',
            body: undefined,
          },
          {
            method: 'PATCH',
            url: '/repos/LB/ABC/check-runs/123',
            body: {
              status: 'completed',
              conclusion: 'success',
            },
          },
        ],
      },
      {
        name: 'creation on remote repository',
        checkName: 'testo',
        status: Status.Completed,
        conclusion: Conclusion.Success,
        repo: 'remote/repo',
        sha: 'DEF',
        expectedRequests: [
          {
            method: 'POST',
            url: '/repos/remote/repo/check-runs',
            body: {
              conclusion: 'success',
              head_sha: 'DEF',
              name: 'testo',
              status: 'completed',
            },
          },
        ],
        expectedCheckID: 456,
      },
      {
        name: 'update on remote repository',
        checkID: '123',
        status: Status.Completed,
        conclusion: Conclusion.Success,
        repo: 'remote/repo',
        sha: 'DEF',
        expectedRequests: [
          {
            method: 'GET',
            url: '/repos/remote/repo/check-runs/123',
            body: undefined,
          },
          {
            method: 'PATCH',
            url: '/repos/remote/repo/check-runs/123',
            body: {
              status: 'completed',
              conclusion: 'success',
            },
          },
        ],
      },
      {
        name: 'fails with invalid repo',
        checkID: '123',
        status: Status.Completed,
        conclusion: Conclusion.Success,
        repo: 'invalid',
        sha: 'DEF',
        expectedError: 'repo needs to be in the {owner}/{repository} format',
      },
      {
        name: 'creation from pull_request',
        checkName: 'testo',
        eventName: 'pull_request',
        eventRecord: {
          pull_request: {
            head: {
              sha: '123',
            },
          },
        },
        status: Status.Completed,
        conclusion: Conclusion.Success,
        expectedRequests: [
          {
            method: 'POST',
            url: '/repos/LB/ABC/check-runs',
            body: {
              conclusion: 'success',
              head_sha: '123',
              name: 'testo',
              status: 'completed',
            },
          },
        ],
        expectedCheckID: 456,
      },
      // TODO: add more
    ];
  })();

  test.each(cases)(
    'with $name',
    async ({expectedError, expectedRequests, expectedCheckID, ...rest}: Case) => {
      const requests: Array<LoggedRequest> = [];

      await mockHTTPServer(
        (reqMethod, reqURL, reqHeaders, reqBody) => {
          if (reqBody !== undefined) {
            delete reqBody['completed_at'];
            delete reqBody['started_at'];
          }
          requests.push({method: reqMethod, url: reqURL, body: reqBody});
          let reply = {};
          if (expectedCheckID !== undefined) {
            reply = {id: expectedCheckID};
          }
          return {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
            reply,
          };
        },
        async port => {
          await mockEventFile(rest.eventRecord || {}, async filename => {
            const props = {
              name: rest.checkName,
              id: rest.checkID,
              status: rest.status.toString(),
              conclusion: rest.conclusion.toString(),
              repo: rest.repo,
              sha: rest.sha,
              token: rest.token,
              eventName: rest.eventName,
              eventPath: rest.eventRecord ? filename : undefined,
              testPort: port,
            };

            const {error, checkID} = await runAction(props);

            expect(error).toBe(expectedError);
            expect(checkID).toBe(expectedCheckID);
            if (expectedRequests !== undefined) {
              expect(requests).toEqual(expectedRequests);
            } else {
              expect(requests).toEqual([]);
            }
          });
        },
      );
    },
  );
});
