import { convertTransfersToCsv, convertTransfersToExcel, convertTransfersToJson } from '@services/export/export.utils';
import { ExportJobList } from '@services/export/export.interfaces';
import { WailsService } from '@services/wails/wails.service';
import { of } from 'rxjs';

describe('[exportUtils] convertTransfersToCsv', () => {
    it('should call generateCsvReport on WailsService', (done) => {
        const wails = jasmine.createSpyObj<WailsService>('WailsService', ['generateCsvReport']);
        wails.generateCsvReport.and.returnValue(of('csv-base64'));

        convertTransfersToCsv(wails, {} as ExportJobList).subscribe((result) => {
            expect(wails.generateCsvReport).toHaveBeenCalled();
            expect(result).toBe('csv-base64');
            done();
        });
    });
});

describe('[exportUtils] convertTransfersToJson', () => {
    it('should call generateJsonReport on WailsService', (done) => {
        const wails = jasmine.createSpyObj<WailsService>('WailsService', ['generateJsonReport']);
        wails.generateJsonReport.and.returnValue(of('json-base64'));

        convertTransfersToJson(wails, {} as ExportJobList).subscribe((result) => {
            expect(wails.generateJsonReport).toHaveBeenCalled();
            expect(result).toBe('json-base64');
            done();
        });
    });
});

describe('[exportUtils] convertTransfersToExcel', () => {
    it('should call generateExcelReport on WailsService', (done) => {
        const wails = jasmine.createSpyObj<WailsService>('WailsService', ['generateExcelReport']);
        wails.generateExcelReport.and.returnValue(of('xlsx-base64'));

        convertTransfersToExcel(wails, {} as ExportJobList).subscribe((result) => {
            expect(wails.generateExcelReport).toHaveBeenCalled();
            expect(result).toBe('xlsx-base64');
            done();
        });
    });
});
