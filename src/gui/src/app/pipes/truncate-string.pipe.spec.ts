import { TruncateStringPipe } from '@app/pipes/truncate-string.pipe';

describe('TruncateStringPipe', () => {
    let pipe: TruncateStringPipe;

    beforeEach(() => {
        pipe = new TruncateStringPipe();
    });

    it('should create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should return the original string if length is less than default max ', () => {
        const input = 'original string';
        const expected = input;
        const result = pipe.transform(input);
        expect(result).toEqual(expected);
    });

    it('should truncate the string if length is greater than default max', () => {
        const input = 'This is a long string testing testing testing';
        const expected = 'This is a long st…g testing testing';
        const result = pipe.transform(input);
        expect(result).toEqual(expected);
    });

    it('should return the original string if length is less than the provided max length', () => {
        const input = 'original string';
        const maxLength = 20;
        const expected = input;
        const result = pipe.transform(input, maxLength);
        expect(result).toEqual(expected);
    });

    it('should truncate the original string if length is greater than the provided max length', () => {
        const input = 'original string';
        const maxLength = 5;
        const expected = 'or…ng';
        const result = pipe.transform(input, maxLength);
        expect(result).toEqual(expected);
    });

    it('should handle empty strings', () => {
        const input = '';
        const maxLength = 10;
        const expected = '';
        const result = pipe.transform(input, maxLength);
        expect(result).toEqual(expected);
    });

});
