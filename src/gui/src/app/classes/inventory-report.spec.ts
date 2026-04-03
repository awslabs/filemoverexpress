import { InventoryReportRequest, InventoryReportStatus } from './inventory-report';

describe('InventoryReportStatus', () => {
    it('should create an instance', () => {
        const report = new InventoryReportStatus(
            'testReportId',
            'test-transfer-profile',
            'my-bucket',
            '',
            'Started',
            new Date(),
            new Date(),
            '/tmp/reports/inventory-report.json',
        );
        expect(report).toBeTruthy();
    });
});

describe('InventoryReportRequest', () => {
    it('should create an instance', () => {
        const req = new InventoryReportRequest();
        expect(req).toBeTruthy();

        req.transferProfile = 'test-transfer-profile';
        req.includeChecksums = true;
        req.outputFile = '/path/to/file';
        req.pretty = true;
        req.outputFormat = 'JSON';

        expect(req.isValid).toBeTruthy();
        expect(req.transferProfile).toBe('test-transfer-profile');
        expect(req.includeChecksums).toBeTruthy();
        expect(req.outputFile).toBe('/path/to/file');
        expect(req.pretty).toBeTruthy();
        expect(req.outputFormat).toBe('JSON');
    });
});
