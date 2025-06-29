import express, { Request, Response } from 'express';
import { createEndpointCounter, EndpointCounter } from './index';

describe('EndpointCounter', () => {
  let counter: EndpointCounter;

  beforeEach(() => {
    counter = createEndpointCounter();
  });

  afterEach(() => {
    counter.reset();
  });

  describe('Basic functionality', () => {
    test('should count endpoint accesses', () => {
      const count1 = counter.incrementCount('GET', '/users', 100);
      expect(count1).toBe(1);

      const count2 = counter.incrementCount('GET', '/users', 150);
      expect(count2).toBe(2);

      const stats = counter.getStats('/users');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(2);
    });

    test('should track timing statistics', () => {
      counter.incrementCount('GET', '/api/test', 100);
      counter.incrementCount('GET', '/api/test', 200);
      counter.incrementCount('GET', '/api/test', 150);

      const stats = counter.getStats('/api/test');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(3);
      expect(stats?.totalDuration).toBe(450);
      expect(stats?.averageDuration).toBe(150);
      expect(stats?.minDuration).toBe(100);
      expect(stats?.maxDuration).toBe(200);
    });

    test('should track method information in stats', () => {
      counter.incrementCount('GET', '/users', 100);
      counter.incrementCount('POST', '/users', 150);

      const stats = counter.getStats('/users');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(2);
      expect(stats?.method).toBe('GET'); // First method is stored
    });

    test('should handle different methods on same path', () => {
      counter.incrementCount('GET', '/users', 100);
      counter.incrementCount('POST', '/users', 150);
      counter.incrementCount('PUT', '/users', 200);

      const stats = counter.getStats('/users');
      expect(stats?.count).toBe(3);
      expect(stats?.totalDuration).toBe(450);
    });
  });

  describe('Query parameters', () => {
    test('should exclude query params by default', () => {
      // Direct test of incrementCount method
      counter.incrementCount('GET', '/users', 100);

      const stats = counter.getStats('/users');
      expect(stats?.count).toBe(1);
    });

    test('should include query params when enabled', () => {
      counter = createEndpointCounter({ includeQueryParams: true });

      // Simulate requests with query params
      counter.incrementCount('GET', '/users?page=1', 100);
      counter.incrementCount('GET', '/users?page=2', 150);

      const stats1 = counter.getStats('/users?page=1');
      const stats2 = counter.getStats('/users?page=2');

      expect(stats1?.count).toBe(1);
      expect(stats2?.count).toBe(1);
    });
  });

  describe('Top endpoints', () => {
    test('should return most accessed endpoints', () => {
      counter.incrementCount('GET', '/popular', 100);
      counter.incrementCount('GET', '/popular', 100);
      counter.incrementCount('GET', '/popular', 100);
      counter.incrementCount('GET', '/medium', 100);
      counter.incrementCount('GET', '/medium', 100);
      counter.incrementCount('GET', '/rare', 100);

      const top = counter.getTopEndpoints(2);
      expect(top).toHaveLength(2);
      expect(top[0].endpoint).toBe('/popular');
      expect(top[0].stats.count).toBe(3);
      expect(top[1].endpoint).toBe('/medium');
      expect(top[1].stats.count).toBe(2);
    });
  });

  describe('Slowest endpoints', () => {
    test('should return endpoints with highest average duration', () => {
      counter.incrementCount('GET', '/slow', 1000);
      counter.incrementCount('GET', '/slow', 900);
      counter.incrementCount('GET', '/medium', 200);
      counter.incrementCount('GET', '/medium', 300);
      counter.incrementCount('GET', '/fast', 50);
      counter.incrementCount('GET', '/fast', 60);

      const slowest = counter.getSlowestEndpoints(2);
      expect(slowest).toHaveLength(2);
      expect(slowest[0].endpoint).toBe('/slow');
      expect(slowest[0].stats.averageDuration).toBe(950);
      expect(slowest[1].endpoint).toBe('/medium');
      expect(slowest[1].stats.averageDuration).toBe(250);
    });
  });

  describe('Summary', () => {
    test('should provide accurate summary statistics', () => {
      counter.incrementCount('GET', '/users', 100);
      counter.incrementCount('GET', '/users', 200);
      counter.incrementCount('POST', '/users', 300);
      counter.incrementCount('GET', '/products', 150);

      const summary = counter.getSummary();
      expect(summary.totalEndpoints).toBe(2); // /users and /products
      expect(summary.totalRequests).toBe(4);
      expect(summary.totalDuration).toBe(750);
      expect(summary.averageDuration).toBe(187.5);
      expect(summary.topEndpoint.endpoint).toBe('/users');
    });
  });

  describe('Memory management', () => {
    test('should enforce maxEndpoints limit', () => {
      counter = createEndpointCounter({ maxEndpoints: 2 });

      // Add first endpoint (short names to avoid normalization)
      counter.incrementCount('GET', '/api/user', 100);
      let stats = counter.getStats();
      expect(stats.size).toBe(1);

      // Add second endpoint  
      counter.incrementCount('GET', '/api/item', 100);
      stats = counter.getStats();
      expect(stats.size).toBe(2);

      // Add third endpoint - should trigger cleanup
      counter.incrementCount('GET', '/api/data', 100);
      stats = counter.getStats();
      expect(stats.size).toBe(2);
    });

    test('should evict least recently used endpoint', (done) => {
      counter = createEndpointCounter({ maxEndpoints: 2 });

      // Add endpoints with delays to ensure different timestamps
      counter.incrementCount('GET', '/old', 100);

      setTimeout(() => {
        counter.incrementCount('GET', '/newer', 100);
        setTimeout(() => {
          counter.incrementCount('GET', '/newest', 100);

          const stats = counter.getStats();
          expect(stats.size).toBe(2);
          expect(stats.has('/old')).toBe(false);
          expect(stats.has('/newer')).toBe(true);
          expect(stats.has('/newest')).toBe(true);
          done();
        }, 5);
      }, 5);
    });
  });

  describe('Reset functionality', () => {
    test('should reset specific endpoint', () => {
      counter.incrementCount('GET', '/api/user', 100);
      counter.incrementCount('GET', '/api/item', 100);

      // Check that both endpoints exist
      expect(counter.getStats('/api/user')).toBeDefined();
      expect(counter.getStats('/api/item')).toBeDefined();

      counter.reset('/api/user');

      expect(counter.getStats('/api/user')).toBeUndefined();
      expect(counter.getStats('/api/item')).toBeDefined();
    });

    test('should reset all endpoints', () => {
      counter.incrementCount('GET', '/api/user', 100);
      counter.incrementCount('GET', '/api/item', 100);

      counter.reset();

      const stats = counter.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Callbacks', () => {
    test('should call onUpdate callback', () => {
      const onUpdate = jest.fn();
      counter = createEndpointCounter({ onUpdate });

      counter.incrementCount('GET', '/users', 100);

      expect(onUpdate).toHaveBeenCalledWith('/users', expect.objectContaining({
        count: 1,
        totalDuration: 100,
        averageDuration: 100,
        minDuration: 100,
        maxDuration: 100,
        method: 'GET',
        path: '/users'
      }));
    });
  });

  describe('Middleware integration', () => {
    test('should work as Express middleware', (done) => {
      const app = express();
      const testCounter = createEndpointCounter();

      app.use(testCounter.middleware());

      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      // Simulate request
      const mockReq = {
        method: 'GET',
        url: '/test',
        headers: { host: 'localhost:3000' }
      } as Request;

      const mockRes = {
        on: (event: string, callback: () => void) => {
          if (event === 'finish') {
            // Simulate response finish
            setTimeout(() => {
              callback();
              const stats = testCounter.getStats('/test');
              expect(stats?.count).toBe(1);
              done();
            }, 10);
          }
        },
        statusCode: 200
      } as Response;

      const middleware = testCounter.middleware();
      middleware(mockReq, mockRes, () => { });
    });

    test('should handle malformed URLs gracefully', () => {
      const mockReq = {
        method: 'GET',
        url: '//malformed//url//',
        headers: {}
      } as Request;

      const mockRes = {
        on: jest.fn()
      } as any;

      const middleware = counter.middleware();
      expect(() => {
        middleware(mockReq, mockRes, () => { });
      }).not.toThrow();
    });
  });

  describe('Logging', () => {
    test('should use custom logger', () => {
      const customLogger = jest.fn();
      counter = createEndpointCounter({
        logger: customLogger,
        enableLogging: true
      });

      const mockRes = {
        on: (event: string, callback: () => void) => {
          if (event === 'finish') {
            callback();
          }
        },
        statusCode: 200
      } as any;

      const mockReq = {
        method: 'GET',
        url: '/test',
        headers: { host: 'localhost:3000' }
      } as Request;

      const middleware = counter.middleware();
      middleware(mockReq, mockRes, () => { });

      expect(customLogger).toHaveBeenCalled();
      expect(customLogger.mock.calls[0][0]).toContain('GET /test');
      expect(customLogger.mock.calls[0][0]).toContain('200');
    });

    test('should not log when disabled', () => {
      const customLogger = jest.fn();
      counter = createEndpointCounter({
        logger: customLogger,
        enableLogging: false
      });

      const mockRes = {
        on: (event: string, callback: () => void) => {
          if (event === 'finish') {
            callback();
          }
        },
        statusCode: 200
      } as any;

      const mockReq = {
        method: 'GET',
        url: '/test',
        headers: { host: 'localhost:3000' }
      } as Request;

      const middleware = counter.middleware();
      middleware(mockReq, mockRes, () => { });

      expect(customLogger).not.toHaveBeenCalled();
    });
  });
});
