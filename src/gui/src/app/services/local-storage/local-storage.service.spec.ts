import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
    let service: LocalStorageService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(LocalStorageService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('set and retrieve string', () => {
        const key = 'stringValue';
        const value = 'Hello world!';
        service.set(key, value);

        expect(service.getString(key)).toEqual(value);
    });

    it('set and retrieve number', () => {
        const key = 'numberValue';
        const value = 1234.321;
        service.set(key, value);

        expect(service.getNumber(key)).toEqual(value);
    });

    it('set and retrieve boolean', () => {
        const key = 'booleanValue';
        const value = true;

        service.set(key, value);
        expect(service.getBoolean(key)).toEqual(true);
    });

    it('set and retrieve object', () => {
        const key = 'objectValue';
        const value = {key1: 'value1', key2: 'value2'};

        service.set(key, value);
        expect(service.getObject(key)).toEqual(value);
    });

    it('set and retrieve array', () => {
        const key = 'arrayValue';
        const value = [
            'value1', 'value2',
        ];

        service.set(key, value);
        expect(service.getObject(key)).toEqual(value);
    });
});
