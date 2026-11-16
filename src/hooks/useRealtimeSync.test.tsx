import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeSync } from './useRealtimeSync';

const { mockCleanup, mockSubscribeToAllTables, mockSubscribeToTable } = vi.hoisted(() => {
  const cleanup = vi.fn();
  return {
    mockCleanup: cleanup,
    mockSubscribeToAllTables: vi.fn(() => cleanup),
    mockSubscribeToTable: vi.fn(() => cleanup),
  };
});

vi.mock('@/lib/realtime', () => ({
  subscribeToAllTables: mockSubscribeToAllTables,
  subscribeToTable: mockSubscribeToTable,
  onTableChange: vi.fn(() => vi.fn()),
}));

function TestHarness({ enabled = true }: { enabled?: boolean }) {
  useRealtimeSync({ enabled });
  return null;
}

describe('useRealtimeSync offline handling', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('unsubscribes when going offline and resubscribes when back online', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TestHarness enabled />
      </QueryClientProvider>
    );

    expect(mockSubscribeToAllTables).toHaveBeenCalledTimes(1);
    expect(mockCleanup).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(mockCleanup).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockSubscribeToAllTables).toHaveBeenCalledTimes(2);
  });

  it('does not subscribe while initially offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TestHarness enabled />
      </QueryClientProvider>
    );

    expect(mockSubscribeToAllTables).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockSubscribeToAllTables).toHaveBeenCalledTimes(1);
  });
});
