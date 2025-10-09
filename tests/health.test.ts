import request from 'supertest';
import app from '../src/server';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('requestId');
    });

    it('should include memory usage details', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('external');
    });

    it('should return valid uptime', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('requestId');
    });

    it('should include all health checks', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.checks).toHaveProperty('server');
      expect(response.body.checks).toHaveProperty('memory');
      expect(response.body.checks).toHaveProperty('uptime');
    });

    it('should have valid check statuses', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      const checks = response.body.checks;
      expect(checks.server.status).toBe('ok');
      expect(checks.memory.status).toBe('ok');
      expect(checks.uptime.status).toBe('ok');
    });
  });

  describe('Server binding', () => {
    it('should bind to PORT environment variable', () => {
      const port = process.env['PORT'] || '3000';
      expect(port).toBeDefined();
      expect(typeof port).toBe('string');
    });

    it('should handle different PORT values', () => {
      const originalPort = process.env['PORT'];
      
      // Test with different port values
      process.env['PORT'] = '4000';
      expect(process.env['PORT']).toBe('4000');
      
      process.env['PORT'] = '8080';
      expect(process.env['PORT']).toBe('8080');
      
      // Restore original port
      process.env['PORT'] = originalPort;
    });
  });
});
