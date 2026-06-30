import { TestBed } from '@angular/core/testing';
import { WailsService } from './wails.service';

describe('WailsService', () => {
    let service: WailsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [WailsService],
        });
        service = TestBed.inject(WailsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should have startDaemon method', () => {
        expect(service.startDaemon).toBeDefined();
    });

    it('should have fatalShutdown method', () => {
        expect(service.fatalShutdown).toBeDefined();
    });

    it('should have systemOpen method', () => {
        expect(service.systemOpen).toBeDefined();
    });

    it('should have systemShowItemInFolder method', () => {
        expect(service.systemShowItemInFolder).toBeDefined();
    });

    it('should have externalLink method', () => {
        expect(service.externalLink).toBeDefined();
    });

    it('should have appVersion method', () => {
        expect(service.appVersion).toBeDefined();
    });

    it('should have firstLaunchComplete method', () => {
        expect(service.firstLaunchComplete).toBeDefined();
    });

    it('should have onFatalShutdown method', () => {
        expect(service.onFatalShutdown).toBeDefined();
    });
});
