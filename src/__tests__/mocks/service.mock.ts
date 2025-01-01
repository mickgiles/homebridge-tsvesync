export class MockService {
  constructor(public readonly UUID: string) {}

  getCharacteristic() {
    return {
      on: jest.fn().mockReturnThis(),
      updateValue: jest.fn(),
    };
  }

  setCharacteristic() {
    return this;
  }
} 