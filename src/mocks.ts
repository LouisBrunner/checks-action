const replaceURL = (url: URL, port: string): URL => {
  url.host = 'localhost';
  url.port = port;
  url.protocol = 'http';
  return url;
};

const localPort = process.env.INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT;

export const useLocalFetcher = localPort !== undefined;

export const localFetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (!localPort) {
    throw new Error('INTERNAL_TESTING_MODE_HTTP_LOCAL_PORT is not defined');
  }

  console.debug('localFetcher::before', input);
  if (typeof input === 'string') {
    input = replaceURL(new URL(input), localPort).toString();
  } else if (input instanceof URL) {
    input = replaceURL(input, localPort);
  } else {
    input = {
      ...input,
      url: replaceURL(new URL(input.url), localPort).toString(),
    };
  }
  console.debug('localFetcher::after', input);

  return fetch(input, init);
};
