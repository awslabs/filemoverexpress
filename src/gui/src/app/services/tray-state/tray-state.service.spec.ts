import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TrayStateService, TrayTab } from './tray-state.service';

describe('TrayStateService', () => {
    let service: TrayStateService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(TrayStateService);
    });

    describe('initial state', () => {
        it('should start collapsed', () => {
            expect(service.collapsed()).toBe(true);
        });

        it('should default to the Jobs tab', () => {
            expect(service.activeTab()).toBe(TrayTab.Jobs);
        });
    });

    describe('toggle', () => {
        it('should expand when collapsed', () => {
            service.toggle();
            expect(service.collapsed()).toBe(false);
        });

        it('should collapse when expanded', () => {
            service.expand();
            service.toggle();
            expect(service.collapsed()).toBe(true);
        });
    });

    describe('expand', () => {
        it('should set collapsed to false', () => {
            service.expand();
            expect(service.collapsed()).toBe(false);
        });

        it('should be idempotent when already expanded', () => {
            service.expand();
            service.expand();
            expect(service.collapsed()).toBe(false);
        });
    });

    describe('collapse', () => {
        it('should set collapsed to true', () => {
            service.expand();
            service.collapse();
            expect(service.collapsed()).toBe(true);
        });

        it('should be idempotent when already collapsed', () => {
            service.collapse();
            expect(service.collapsed()).toBe(true);
        });
    });

    describe('setActiveTab', () => {
        it('should update activeTab to Logs', () => {
            service.setActiveTab(TrayTab.Logs);
            expect(service.activeTab()).toBe(TrayTab.Logs);
        });

        it('should update activeTab to Reports', () => {
            service.setActiveTab(TrayTab.Reports);
            expect(service.activeTab()).toBe(TrayTab.Reports);
        });

        it('should update activeTab back to Jobs', () => {
            service.setActiveTab(TrayTab.Reports);
            service.setActiveTab(TrayTab.Jobs);
            expect(service.activeTab()).toBe(TrayTab.Jobs);
        });

        it('should not affect collapsed state', () => {
            service.setActiveTab(TrayTab.Logs);
            expect(service.collapsed()).toBe(true);
        });
    });

    describe('showReports', () => {
        it('should set activeTab to Reports', () => {
            service.showReports();
            expect(service.activeTab()).toBe(TrayTab.Reports);
        });

        it('should expand the tray', () => {
            service.showReports();
            expect(service.collapsed()).toBe(false);
        });

        it('should expand even if already on a different tab', () => {
            service.setActiveTab(TrayTab.Logs);
            service.collapse();
            service.showReports();
            expect(service.activeTab()).toBe(TrayTab.Reports);
            expect(service.collapsed()).toBe(false);
        });
    });
});
