import { vi } from "vitest";

// Provide env vars that routes.ts reads at module level
process.env.ADMIN_PASSWORD = "test-admin-pass";
process.env.SESSION_SECRET = "test-session-secret";

// Mock the storage module before any route imports
vi.mock("../server/storage", async () => {
  const { MockStorage } = await import("./mocks/storage");
  return { storage: new MockStorage() };
});

// Mock email sending
vi.mock("../server/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock bitcoin-node (nodeManager singleton)
vi.mock("../server/bitcoin-node", () => ({
  nodeManager: {
    getOrCreate: vi.fn().mockResolvedValue({}),
    exec: vi.fn().mockResolvedValue({ result: "mock-result" }),
    rpc: vi.fn().mockResolvedValue({ result: "mock-rpc" }),
    getStatus: vi.fn().mockReturnValue({ running: false }),
    startCleanup: vi.fn(),
    stopAll: vi.fn(),
    ensureBitcoindBinary: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock child_process.spawn (used by startLexeSidecar)
vi.mock("child_process", () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    pid: 12345,
    stdout: null,
    stderr: null,
  }),
}));

// Mock fs.existsSync (used by startLexeSidecar)
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Mock QRCode (used by lnauth/challenge)
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
  },
}));

// Suppress noisy console output during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
