import { parseGithubLinkHeader } from './discovery';

export class GithubApiError extends Error {
  status: number;
  url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
    this.url = url;
  }
}

export class RateLimitError extends GithubApiError {
  resetTime?: number;

  constructor(message: string, resetTime?: number, url: string = '') {
    super(message, 429, url);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

export class AuthError extends GithubApiError {
  constructor(message: string, status: number = 401, url: string = '') {
    super(message, status, url);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends GithubApiError {
  constructor(message: string, url: string = '') {
    super(message, 404, url);
    this.name = 'NotFoundError';
  }
}

export interface FetchPageResult<T> {
  data: T;
  notModified?: boolean;
  etag?: string;
  nextUrl?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface FetchAllPagesResult<T> {
  items: T[];
  pageCount: number;
  notModified?: boolean;
  etag?: string;
}

export interface FetchJsonResponse<T> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T | null;
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
  maxRetries = 3
): Promise<FetchJsonResponse<T>> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      let data: T | null = null;
      if (res.status !== 304 && res.ok) {
        // Parse JSON body while AbortController timer remains ACTIVE to abort hung socket streams
        data = await res.json();
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        data,
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || controller.signal.aborted;
      const isNetworkError =
        !isTimeout &&
        (err.message?.includes('fetch failed') ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND');

      if (attempt < maxRetries && (isNetworkError || isTimeout)) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      if (isTimeout) {
        throw new Error(`HTTP request timed out after ${timeoutMs}ms for '${url}'`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`HTTP request failed after ${maxRetries} attempts for '${url}'`);
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
  maxRetries = 3
): Promise<Response> {
  const jsonRes = await fetchJsonWithTimeout<any>(url, options, timeoutMs, maxRetries);
  return new Response(jsonRes.data !== null ? JSON.stringify(jsonRes.data) : null, {
    status: jsonRes.status,
    statusText: jsonRes.statusText,
    headers: jsonRes.headers,
  });
}

export class GithubApiClient {
  private token?: string;
  private static etagCache = new Map<string, string>();

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  public getEtag(url: string): string | undefined {
    return GithubApiClient.etagCache.get(url);
  }

  public setEtag(url: string, etag: string | null): void {
    if (etag) {
      GithubApiClient.etagCache.set(url, etag);
    } else {
      GithubApiClient.etagCache.delete(url);
    }
  }

  public clearEtags(): void {
    GithubApiClient.etagCache.clear();
  }

  private getHeaders(etag?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Repo-Rescue-Injector-V1',
      Accept: 'application/vnd.github.v3+json',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    return headers;
  }

  async fetchPage<T>(url: string, customEtag?: string): Promise<FetchPageResult<T>> {
    const cachedEtag = customEtag || this.getEtag(url);
    const headers = this.getHeaders(cachedEtag);
    let res: FetchJsonResponse<T>;

    try {
      res = await fetchJsonWithTimeout<T>(url, { headers }, 15000);
    } catch (err: any) {
      throw new GithubApiError(`Network fetch failure for '${url}': ${err.message || String(err)}`, 0, url);
    }

    const remainingStr = res.headers.get('x-ratelimit-remaining');
    const resetStr = res.headers.get('x-ratelimit-reset');
    const rateLimitRemaining = remainingStr ? parseInt(remainingStr, 10) : undefined;
    const rateLimitReset = resetStr ? parseInt(resetStr, 10) : undefined;

    // HTTP 304 Not Modified
    if (res.status === 304) {
      return {
        data: [] as any,
        notModified: true,
        etag: cachedEtag,
        rateLimitRemaining,
        rateLimitReset,
      };
    }

    if (res.status < 200 || res.status >= 300) {
      if (res.status === 403 || res.status === 429) {
        if (rateLimitRemaining === 0) {
          throw new RateLimitError(`GitHub API rate limit exceeded for '${url}'.`, rateLimitReset, url);
        }
        throw new AuthError(`GitHub API access forbidden (HTTP ${res.status}) for '${url}'.`, res.status, url);
      }
      if (res.status === 401) {
        throw new AuthError(`GitHub API authentication failed (HTTP 401) for '${url}'.`, 401, url);
      }
      if (res.status === 404) {
        throw new NotFoundError(`GitHub resource not found (HTTP 404) at '${url}'.`, url);
      }
      throw new GithubApiError(`GitHub API error HTTP ${res.status} (${res.statusText}) for '${url}'.`, res.status, url);
    }

    const data: T = res.data!;
    const linkHeader = res.headers.get('Link');
    const parsedLink = parseGithubLinkHeader(linkHeader);
    const newEtag = res.headers.get('ETag') || undefined;

    if (newEtag) {
      this.setEtag(url, newEtag);
    }

    return {
      data,
      notModified: false,
      etag: newEtag,
      nextUrl: parsedLink.next,
      rateLimitRemaining,
      rateLimitReset,
    };
  }

  async fetchAllPages<T>(initialUrl: string, etag?: string): Promise<FetchAllPagesResult<T>> {
    let currentUrl: string | undefined = initialUrl;
    const allItems: T[] = [];
    let pageCount = 0;

    while (currentUrl) {
      pageCount++;
      const isFirstPage = pageCount === 1;
      const result: FetchPageResult<T[]> = await this.fetchPage<T[]>(currentUrl, isFirstPage ? etag : undefined);

      if (isFirstPage && result.notModified) {
        return {
          items: [],
          pageCount: 1,
          notModified: true,
          etag: result.etag,
        };
      }

      if (Array.isArray(result.data)) {
        allItems.push(...result.data);
      }

      currentUrl = result.nextUrl;
    }

    return {
      items: allItems,
      pageCount,
      notModified: false,
    };
  }

  /**
   * Fetches issues and pull requests updated since a specific timestamp using REST API & ETags.
   */
  async fetchIncrementalIssues<T>(
    repoFullName: string,
    sinceDate?: string | Date,
    etag?: string
  ): Promise<FetchAllPagesResult<T>> {
    let url = `https://api.github.com/repos/${repoFullName}/issues?state=all&sort=updated&direction=asc&per_page=100`;
    if (sinceDate) {
      const sinceIso = typeof sinceDate === 'string' ? sinceDate : sinceDate.toISOString();
      url += `&since=${encodeURIComponent(sinceIso)}`;
    }
    return this.fetchAllPages<T>(url, etag);
  }

  /**
   * Fetches 100% of issues from a repository using date-window advancing (sort=created&direction=asc + since)
   * to bypass GitHub REST API's 1,000-result pagination ceiling without truncation.
   */
  async fetchAllIssuesComplete<T extends { id: number; number: number; created_at: string }>(
    repoFullName: string,
    stateFilter: 'open' | 'closed' | 'all' = 'open'
  ): Promise<{ items: T[]; pageCount: number; isTruncated: boolean }> {
    const itemMap = new Map<number, T>();
    let pageCount = 0;
    let since: string | undefined = undefined;
    let windowHasMore = true;

    while (windowHasMore) {
      let page = 1;
      let lastCreatedAtInWindow: string | undefined = undefined;

      while (page <= 10) {
        pageCount++;
        let url = `https://api.github.com/repos/${repoFullName}/issues?state=${stateFilter}&sort=created&direction=asc&per_page=100&page=${page}`;
        if (since) {
          url += `&since=${encodeURIComponent(since)}`;
        }

        console.log(
          `[GithubApiClient] Fetching page ${pageCount} (window page ${page}) for '${repoFullName}'${
            since ? ` (since ${since})` : ''
          }...`
        );

        let pageResult: FetchPageResult<T[]>;
        try {
          pageResult = await this.fetchPage<T[]>(url);
        } catch (err: any) {
          if (err instanceof GithubApiError && err.status === 422) {
            console.log(`[GithubApiClient] 422 ceiling hit on window page ${page} for '${repoFullName}', advancing date window.`);
            break;
          }
          throw err;
        }

        const data = pageResult.data || [];
        console.log(
          `[GithubApiClient] Page ${pageCount} complete for '${repoFullName}': fetched ${
            data.length
          } items. Accumulated unique items: ${itemMap.size + data.length}`
        );

        if (!Array.isArray(data) || data.length === 0) {
          windowHasMore = false;
          break;
        }

        for (const item of data) {
          if (item && item.number) {
            itemMap.set(item.number, item);
            lastCreatedAtInWindow = item.created_at || lastCreatedAtInWindow;
          }
        }

        if (data.length < 100) {
          windowHasMore = false;
          break;
        }

        page++;
      }

      // If page reached 10 and there are more items, advance since timestamp to last item's created_at
      if (windowHasMore && lastCreatedAtInWindow && lastCreatedAtInWindow !== since) {
        since = lastCreatedAtInWindow;
      } else {
        windowHasMore = false;
      }
    }

    return {
      items: Array.from(itemMap.values()),
      pageCount,
      isTruncated: false,
    };
  }
}
