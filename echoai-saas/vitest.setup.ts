import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.INTEGRATION_ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';

// Mock Supabase client
vi.mock('@/lib/supabase/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn() })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      eq: vi.fn(() => ({ single: vi.fn() })),
    })),
  })),
}));

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: vi.fn(() => Buffer.from('test-random-bytes')),
    scryptSync: vi.fn(() => Buffer.from('test-key')),
    createCipherGCM: vi.fn(() => ({
      update: vi.fn(() => 'encrypted'),
      final: vi.fn(() => ''),
      getAuthTag: vi.fn(() => Buffer.from('auth-tag')),
    })),
    createDecipherGCM: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => 'decrypted'),
      final: vi.fn(() => ''),
    })),
  },
});