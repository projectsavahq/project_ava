import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  // Cleanup after all tests
});

// Mock external dependencies for tests
jest.mock("@google-cloud/speech");
jest.mock("@google-cloud/text-to-speech");
jest.mock("openai");
