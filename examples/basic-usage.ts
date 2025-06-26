import express from 'express';
import { createEndpointCounter } from '../src';

const app = express();
const port = 3000;

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const summary = counter.getSummary();
  const top = counter.getTopEndpoints(5);
  const slowest = counter.getSlowestEndpoints(5);

  const allStats = Array.from(counter.getStats().entries()).map(([endpoint, stats]) => ({
    endpoint,
    ...stats,
    lastAccessed: stats.lastAccessedAt.toISOString()
  }));

  res.json({
    summary,
    topEndpoints: top,
    slowestEndpoints: slowest,
    all: allStats
  });
});

app.get('/api/target', (req, res) => {
  const pathname = req.query.pathname;
  console.log(`Target endpoint requested: ${pathname}`);
  if (typeof pathname !== 'string') {
    return res.status(400).json({ error: 'Endpoint query parameter is required' });
  }
  const stats = counter.getStats(pathname);
  if (stats) {
    res.json({
      endpoint: pathname,
      ...stats,
      lastAccessed: stats.lastAccessedAt.toISOString()
    });
  } else {
    res.status(404).json({ error: `No statistics found for endpoint: ${pathname}` });
  }
});

// Create counter with custom options
const counter = createEndpointCounter({
  groupByMethod: true,
  normalizePaths: true,
  maxEndpoints: 500,
  onUpdate: (endpoint, stats) => {
    // Log only when endpoint is called more than 10 times
    if (stats.count % 10 === 0) {
      console.log(`Milestone: ${endpoint} called ${stats.count} times`);
    }
  }
});

// Apply the middleware
app.use(counter.middleware());

// Sample routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

app.get('/users', (req, res) => {
  res.json({ users: ['Alice', 'Bob', 'Charlie'] });
});

app.get('/users/:id', (req, res) => {
  res.json({
    user: {
      id: req.params.id,
      name: `User ${req.params.id}`
    }
  });
});

app.post('/users', (req, res) => {
  res.status(201).json({
    user: {
      id: '123',
      name: 'New User'
    }
  });
});

app.get('/products/:id', (req, res) => {
  // Simulate variable response times
  const delay = Math.random() * 200;
  setTimeout(() => {
    res.json({
      product: {
        id: req.params.id,
        name: `Product ${req.params.id}`
      }
    });
  }, delay);
});

// Reset endpoint
app.post('/api/stats/reset', (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };

  if (endpoint) {
    counter.reset(endpoint);
    res.json({ message: `Reset statistics for ${endpoint}` });
  } else {
    counter.reset();
    res.json({ message: 'Reset all statistics' });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`View stats at http://localhost:${port}/api/stats`);
});
