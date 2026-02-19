import '@testing-library/jest-dom';

declare const global: typeof globalThis & {
  localStorage: Storage;
  requestAnimationFrame: typeof window.requestAnimationFrame;
  cancelAnimationFrame: typeof window.cancelAnimationFrame;
};

class LocalStorageMock {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  get length() {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
}

global.localStorage = new LocalStorageMock() as Storage;
HTMLCanvasElement.prototype.getContext = function (contextType: string) {
  if (contextType === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      rect: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn(),
      })),
      createPattern: jest.fn(() => 'pattern'),
    } as any;
  }
  return null;
} as any;
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 0);
  return 0;
});

global.cancelAnimationFrame = jest.fn();
