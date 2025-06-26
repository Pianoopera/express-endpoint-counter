import { Request, Response, NextFunction } from 'express';

export interface EndpointStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastAccessedAt: Date;
  method: string;
  path: string;
}

export interface CounterOptions {
  /** Include query parameters in endpoint identification */
  includeQueryParams?: boolean;
  /** Group endpoints by HTTP method */
  groupByMethod?: boolean;
  /** Maximum number of endpoints to track (for memory management) */
  maxEndpoints?: number;
  /** Normalize dynamic route parameters (e.g., /users/:id -> /users/:id) */
  normalizePaths?: boolean;
  /** Callback function called when stats are updated */
  onUpdate?: (endpoint: string, stats: EndpointStats) => void;
  /** Enable console logging */
  enableLogging?: boolean;
  /** Custom logger function */
  logger?: (message: string) => void;
}

export class EndpointCounter {
  private stats: Map<string, EndpointStats> = new Map();
  private options: Required<CounterOptions>;

  constructor(options: CounterOptions = {}) {
    this.options = {
      includeQueryParams: false,
      groupByMethod: true,
      maxEndpoints: 1000,
      normalizePaths: true,
      onUpdate: () => { },
      enableLogging: true,
      logger: console.log,
      ...options
    };
  }

  private decodeURL(url: URL): string {
    return decodeURIComponent(url.pathname);
  }

  private cleanupIfNeeded(): void {
    if (this.stats.size >= this.options.maxEndpoints) {
      // Remove the least recently accessed endpoint
      let lruKey: string | null = null;
      let lruTime = new Date();

      for (const [key, stats] of this.stats.entries()) {
        if (stats.lastAccessedAt < lruTime) {
          lruTime = stats.lastAccessedAt;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.stats.delete(lruKey);
      }
    }
  }

  /**
   * Increment the counter for a specific endpoint
   */
  public incrementCount(method: string, pathname: string, duration: number): number {
    this.cleanupIfNeeded();

    const currentStats = this.stats.get(pathname) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastAccessedAt: new Date(),
      method,
      path: pathname
    };

    currentStats.count++;
    currentStats.totalDuration += duration;
    currentStats.averageDuration = currentStats.totalDuration / currentStats.count;
    currentStats.minDuration = Math.min(currentStats.minDuration, duration);
    currentStats.maxDuration = Math.max(currentStats.maxDuration, duration);
    currentStats.lastAccessedAt = new Date();

    this.stats.set(pathname, currentStats);

    this.options.onUpdate(pathname, currentStats);

    return currentStats.count;
  }

  /**
   * Get statistics for a specific endpoint or all endpoints
   */
  public getStats(): Map<string, EndpointStats>;
  public getStats(endpoint: string): EndpointStats | undefined;
  public getStats(endpoint?: string): EndpointStats | Map<string, EndpointStats> | undefined {
    if (endpoint) {
      return this.stats.get(endpoint);
    }
    return new Map(this.stats);
  }

  /**
   * Get the top N most accessed endpoints
   */
  public getTopEndpoints(limit: number = 10): Array<{ endpoint: string; stats: EndpointStats }> {
    return Array.from(this.stats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([endpoint, stats]) => ({ endpoint, stats }));
  }

  /**
   * Get the slowest N endpoints by average duration
   */
  public getSlowestEndpoints(limit: number = 10): Array<{ endpoint: string; stats: EndpointStats }> {
    return Array.from(this.stats.entries())
      .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
      .slice(0, limit)
      .map(([endpoint, stats]) => ({ endpoint, stats }));
  }

  /**
   * Get summary statistics
   */
  public getSummary() {
    const allStats = Array.from(this.stats.values());
    const totalRequests = allStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalDuration = allStats.reduce((sum, stat) => sum + stat.totalDuration, 0);

    return {
      totalEndpoints: this.stats.size,
      totalRequests,
      totalDuration,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      topEndpoint: this.getTopEndpoints(1)[0],
      slowestEndpoint: this.getSlowestEndpoints(1)[0]
    };
  }

  /**
   * Reset statistics for a specific endpoint or all endpoints
   */
  public reset(endpoint?: string): void {
    if (endpoint) {
      this.stats.delete(endpoint);
    } else {
      this.stats.clear();
    }
  }

  /**
   * Express middleware
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      // Parse URL safely
      let url: URL;
      try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      } catch (error) {
        // Fallback for malformed URLs
        url = new URL(req.url, 'http://localhost');
      }

      res.on('finish', () => {
        const duration = Date.now() - start;
        const pathname = this.options.includeQueryParams
          ? this.decodeURL(url) + url.search
          : this.decodeURL(url);

        const count = this.incrementCount(req.method, pathname, duration);

        if (this.options.enableLogging) {
          const message = `[${new Date().toISOString()}] ${req.method} ${pathname} - ${res.statusCode} - ${duration}ms (count: ${count})`;
          this.options.logger(message);
        }
      });

      next();
    };
  }
}

/**
 * Factory function to create a new EndpointCounter instance
 */
export function createEndpointCounter(options?: CounterOptions): EndpointCounter {
  return new EndpointCounter(options);
}

/**
 * Standalone middleware for simple usage
 */
export function endpointCounterMiddleware(options?: CounterOptions) {
  const counter = new EndpointCounter(options);
  return counter.middleware();
}

// Re-export types
export default EndpointCounter;
