import { InventoryReportRequest as IInventoryReportRequest } from '../interfaces/inventory-reports';

export class InventoryReportStatus {
    constructor(
        public reportId: string,
        public transferProfile: string,
        public bucket: string,
        public prefix: string,
        public status: string,
        public started: Date,
        public completed: Date | null,
        public outputFile: string | null,
    ) {

    }
}

export class InventoryReportRequest implements IInventoryReportRequest {
    private _transferProfile = '';
    private _outputFormat = 'JSON';
    private _pretty = false;
    private _includeChecksums = false;
    private _outputFile = '';

    get isValid(): boolean {
        return this.transferProfile !== '';
    }

    get includeChecksums(): boolean {
        return this._includeChecksums;
    }

    set includeChecksums(value: boolean) {
        this._includeChecksums = value;
    }

    get outputFormat(): string {
        return this._outputFormat;
    }

    set outputFormat(value: string) {
        this._outputFormat = value;
    }

    get pretty(): boolean {
        return this._pretty;
    }

    set pretty(value: boolean) {
        this._pretty = value;
    }

    get transferProfile(): string {
        return this._transferProfile;
    }

    set transferProfile(value: string) {
        this._transferProfile = value;
    }

    get outputFile(): string {
        return this._outputFile;
    }

    set outputFile(value: string) {
        this._outputFile = value;
    }
}
