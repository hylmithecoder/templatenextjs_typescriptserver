declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toMatch(expected: RegExp | string): void;
    toHaveLength(expected: number): void;
    toMatchObject(expected: Record<string, unknown>): void;
    toThrow(expected?: RegExp | string): void;
  }
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function test(
    name: string,
    fn: () => void | Promise<void>,
    timeout?: number,
  ): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matchers & {
    not: Matchers;
    rejects: {
      toThrow(expected?: RegExp | string): Promise<void>;
    };
  };
}
