import { describe, it, expect } from 'vitest';
import { fileOrderListValidator, maxActiveChecksumsValidator, noSpacesValidator, s3ArnRgx } from './form-validators';
import { UntypedFormControl } from '@angular/forms';

describe('fileOrderListValidator', () => {
    it('should return null with empty input', () => {
        const control = new UntypedFormControl('input');
        control.setValue([]);
        expect(fileOrderListValidator(control)).toBeNull();

        control.setValue(null);
        expect(fileOrderListValidator(control)).toBeNull();
    });

    it('should return null with valid input', () => {
        const control = new UntypedFormControl('input');
        control.setValue([
            '.exr', '.mov',
        ]);
        expect(fileOrderListValidator(control)).toBeNull();
    });

    it('should return error with invalid input', () => {
        const control = new UntypedFormControl('input');
        control.setValue([
            'exr', 'mov',
        ]);
        expect(fileOrderListValidator(control)).toEqual({invalidFileOrder: true});
    });
});

describe('maxActiveChecksumsValidator', () => {
    const validator = maxActiveChecksumsValidator(10);

    it('should return null with valid input', () => {
        const control = new UntypedFormControl('input');
        control.setValue(10);

        expect(validator(control)).toBeNull();
    });

    it('should return error with invalid input', () => {
        const control = new UntypedFormControl('input');

        control.setValue(12);
        expect(validator(control)).toEqual({invalidChecksum: true});

        control.setValue('string');
        expect(validator(control)).toEqual({invalidChecksum: true});
    });
});

describe('noSpacesValidator', () => {
    it('should return null with valid input', () => {
        const control = new UntypedFormControl('input');
        control.setValue('helloworld');
        expect(noSpacesValidator(control)).toBeNull();
    });

    it('should return error with invalid input', () => {
        const control = new UntypedFormControl('input');
        control.setValue('hello world');
        expect(noSpacesValidator(control)).toEqual({hasSpaces: true});
    });
});

describe('s3ArnRgx', () => {
    it('captures the bucket from an s3:// URI', () => {
        expect('s3://my-bucket'.match(s3ArnRgx)?.groups?.['bucket']).toBe('my-bucket');
    });

    it('captures the bucket from a full S3 ARN (issue #27)', () => {
        expect('arn:aws:s3:::nsft2testing'.match(s3ArnRgx)?.groups?.['bucket']).toBe('nsft2testing');
    });

    it('captures the bucket from an ARN with a trailing key/path', () => {
        expect('arn:aws:s3:::my-bucket/some/key'.match(s3ArnRgx)?.groups?.['bucket']).toBe('my-bucket');
    });

    it('does not match a bare bucket name (nothing to strip)', () => {
        expect('nsft2testing'.match(s3ArnRgx)).toBeNull();
    });
});
