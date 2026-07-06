import { describe, it, expect } from 'vitest';
import { PascalCaseToSpacesPipe } from './pascal-case-to-spaces.pipe';

describe('PascalCaseToSpacesPipe', () => {
    it('create an instance', () => {
        const pipe = new PascalCaseToSpacesPipe();
        expect(pipe).toBeTruthy();
        expect(pipe.transform('TestPascalCasePipe')).toEqual('Test Pascal Case Pipe');
        expect(pipe.transform('testCamelCasePipe')).toEqual('test Camel Case Pipe');
        expect(pipe.transform('')).toEqual('');
    });
});
