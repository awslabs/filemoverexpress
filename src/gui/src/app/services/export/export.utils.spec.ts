import { describe, it, expect, vi } from 'vitest';
import { convertTransfersToCsv, convertTransfersToExcel, convertTransfersToJson } from '@services/export/export.utils';
import { ExportJobList } from '@services/export/export.interfaces';
import { WailsService } from '@services/wails/wails.service';
import { of, firstValueFrom } from 'rxjs';

describe('[exportUtils] convertTransfersToCsv', () => {
    it('should call generateCsvReport on WailsService', async () => {
        const wails = {
            generateCsvReport: vi.fn().mockReturnValue(of('csv-base64')),
            generateJsonReport: vi.fn(),
            generateExcelReport: vi.fn(),
        } as unknown as WailsService;

        const result = await firstValueFrom(convertTransfersToCsv(wails, {} as ExportJobList));
        expect(wails.generateCsvReport).toHaveBeenCalled();
        expect(result).toBe('csv-base64');
    });
});

describe('[exportUtils] convertTransfersToJson', () => {
    it('should call generateJsonReport on WailsService', async () => {
        const wails = {
            generateCsvReport: vi.fn(),
            generateJsonReport: vi.fn().mockReturnValue(of('json-base64')),
            generateExcelReport: vi.fn(),
        } as unknown as WailsService;

        const result = await firstValueFrom(convertTransfersToJson(wails, {} as ExportJobList));
        expect(wails.generateJsonReport).toHaveBeenCalled();
        expect(result).toBe('json-base64');
    });
});

describe('[exportUtils] convertTransfersToExcel', () => {
    it('should call generateExcelReport on WailsService', async () => {
        const wails = {
            generateCsvReport: vi.fn(),
            generateJsonReport: vi.fn(),
            generateExcelReport: vi.fn().mockReturnValue(of('xlsx-base64')),
        } as unknown as WailsService;

        const result = await firstValueFrom(convertTransfersToExcel(wails, {} as ExportJobList));
        expect(wails.generateExcelReport).toHaveBeenCalled();
        expect(result).toBe('xlsx-base64');
    });
});
