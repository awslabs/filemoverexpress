import { describe, it, expect } from 'vitest';
import { UploadPrefixResponse } from './upload-prefix-response';

describe('UploadPrefixResponse', () => {
    it('should create an instance', () => {
        expect(new UploadPrefixResponse(true, '', 0)).toBeTruthy();
    });
});
