import request from 'supertest';
import app from '../src/server';

describe('Webhook Endpoints', () => {
  describe('POST /webhook/whatsapp', () => {
    it('should accept valid webhook payload', async () => {
      const webhookPayload = {
        id: 'test-message-123',
        from: '1234567890@s.whatsapp.net',
        to: '0987654321@s.whatsapp.net',
        body: 'Test message',
        timestamp: Date.now(),
        remoteJid: '120363123456789012@g.us'
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should reject empty body', async () => {
      const response = await request(app)
        .post('/webhook/whatsapp')
        .send()
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Request body is required');
      expect(response.body).toHaveProperty('requestId');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should process webhook asynchronously', async () => {
      const webhookPayload = {
        id: 'async-test-123',
        body: 'Async test message',
        remoteJid: '120363123456789012@g.us'
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond quickly (under 100ms for basic processing)
      expect(responseTime).toBeLessThan(100);
      expect(response.body).toHaveProperty('ok', true);
    });

    it('should include request ID in response', async () => {
      const webhookPayload = {
        id: 'request-id-test-123',
        body: 'Request ID test',
        remoteJid: '120363123456789012@g.us'
      };

      const response = await request(app)
        .post('/webhook/whatsapp')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.requestId.length).toBeGreaterThan(0);
    });
  });

  describe('GET /webhook/test', () => {
    it('should return test status', async () => {
      const response = await request(app)
        .get('/webhook/test')
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message', 'Webhook endpoint is working');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('endpoints');
    });

    it('should include endpoint information', async () => {
      const response = await request(app)
        .get('/webhook/test')
        .expect(200);

      expect(response.body.endpoints).toHaveProperty('webhook', 'POST /webhook/whatsapp');
      expect(response.body.endpoints).toHaveProperty('test', 'GET /webhook/test');
    });
  });

  describe('Error handling', () => {
    it('should handle server errors gracefully', async () => {
      // This test would need to be modified when we add actual error scenarios
      const response = await request(app)
        .post('/webhook/whatsapp')
        .send({ test: 'data' })
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
    });
  });
});
