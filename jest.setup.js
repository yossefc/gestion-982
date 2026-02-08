// Jest setup file

// Mock AsyncStorage with custom implementation
const asyncStorageMock = {
  store: {},
  getItem: jest.fn((key) => Promise.resolve(asyncStorageMock.store[key] || null)),
  setItem: jest.fn((key, value) => {
    asyncStorageMock.store[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete asyncStorageMock.store[key];
    return Promise.resolve();
  }),
  multiGet: jest.fn((keys) => Promise.resolve(keys.map(k => [k, asyncStorageMock.store[k] || null]))),
  multiSet: jest.fn((pairs) => {
    pairs.forEach(([k, v]) => { asyncStorageMock.store[k] = v; });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach(k => delete asyncStorageMock.store[k]);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    asyncStorageMock.store = {};
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageMock.store))),
};

jest.mock('@react-native-async-storage/async-storage', () => asyncStorageMock);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('./src/config/firebase', () => ({
  app: {},
  db: {},
  auth: {},
}));

// Silence console during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
