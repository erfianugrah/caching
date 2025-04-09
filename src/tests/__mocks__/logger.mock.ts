import { vi } from 'vitest';

// Create performance timer mock
const perfTimerMock = {
  startTime: 0,
  start: vi.fn().mockReturnValue(1),
  end: vi.fn()
};

// Create child logger mock
const childLoggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  logResponse: vi.fn(),
  child: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  performance: vi.fn().mockReturnValue(perfTimerMock)
};

// Create the logger mock
export const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  performance: vi.fn().mockReturnValue(perfTimerMock),
  logRequest: vi.fn().mockReturnValue(childLoggerMock),
  logResponse: vi.fn(),
  child: vi.fn().mockReturnValue(childLoggerMock)
};

// Create the updateLoggerConfig mock
export const updateLoggerConfig = vi.fn();