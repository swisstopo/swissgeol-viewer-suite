interface LexicClientConfig {
  baseUrl: string;
}

const config: LexicClientConfig = {
  baseUrl: '',
};

export function configureLexicClient(next: Partial<LexicClientConfig>): void {
  if (next.baseUrl !== undefined) {
    config.baseUrl = trimTrailingSlash(next.baseUrl);
  }
}

export async function lexicFetch<T>(
  requestUrl: string,
  requestOptions: RequestInit,
): Promise<T> {
  const headers = new Headers(requestOptions.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const url = requestUrl.startsWith('http')
    ? requestUrl
    : `${config.baseUrl}${requestUrl}`;

  const response = await fetch(url, {
    ...requestOptions,
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to call Lexic API: [HTTP ${response.status}] ${await response.text()}`,
    );
  }

  const data = await parseResponseBody(response);

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if ([204, 205, 304].includes(response.status)) {
    return {};
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const text = await response.text();
    return text.length === 0 ? {} : JSON.parse(text);
  }

  if (contentType.startsWith('image/')) {
    return response.blob();
  }

  const text = await response.text();
  if (text.length === 0) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
