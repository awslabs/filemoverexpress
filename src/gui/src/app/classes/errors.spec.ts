import { StorageServiceError, StorageServiceErrorType } from './errors';

describe('Errors', () => {
    it('should create an instance', () => {
        const err = new StorageServiceError('Test message', StorageServiceErrorType.NoSuchKey);
        expect(err).toBeTruthy();

        expect(err.errorType).toBe(StorageServiceErrorType.NoSuchKey);
    });
});
