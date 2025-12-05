import request from 'supertest';
import { app } from '../src/index'; // We'll need to export app from index.ts
import { User } from '../src/models/schemas/User';
import { dbConnection } from '../src/models/database';

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Connect to test database
    await dbConnection();
  });

  afterEach(async () => {
    // Clean up test users
    await User.deleteMany({});
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully. Please check your email for verification.');
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.name).toBe(userData.name);
      expect(response.body.data.emailVerified).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' }) // Missing password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email and password are required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ 
          email: 'invalid-email',
          password: 'testpassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ 
          email: 'test@example.com',
          password: 'short'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password must be at least 8 characters long');
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'testpassword123'
      };

      // First signup
      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      // Duplicate signup
      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    let verificationToken: string;
    const userData = {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    };

    beforeEach(async () => {
      // Register and verify user
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send(userData);
      
      verificationToken = signupResponse.body.data.verificationToken;
      
      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken });
    });

    it('should login successfully with verified email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email }) // Missing password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email and password are required');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    const userData = {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    };

    beforeEach(async () => {
      // Register, verify and login user
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send(userData);
      
      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: signupResponse.body.data.verificationToken });
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });
      
      accessToken = loginResponse.body.data.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.name).toBe(userData.name);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });
  });
});