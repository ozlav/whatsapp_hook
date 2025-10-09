"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: 'env.test' });
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';
process.env['PORT'] = '3001';
jest.setTimeout(10000);
const originalConsole = global.console;
beforeAll(() => {
    global.console = {
        ...originalConsole,
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
});
afterAll(() => {
    global.console = originalConsole;
});
//# sourceMappingURL=setup.js.map