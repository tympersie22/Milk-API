import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  displayName: "milki-frontend",
  testEnvironment: "jsdom",
  setupFilesAfterSetup: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: [
    "<rootDir>/**/*.test.{ts,tsx}",
    "<rootDir>/**/*.spec.{ts,tsx}",
  ],
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "context/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },
};

export default createJestConfig(config);
