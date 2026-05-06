import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FileBrowserService } from './file-browser.service';

describe('FileBrowserService', () => {
    let service: FileBrowserService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(FileBrowserService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
