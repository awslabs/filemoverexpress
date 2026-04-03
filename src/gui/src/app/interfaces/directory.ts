import { File } from './file';

export interface Directory {
    path: string;
    folders: string[];
    files: File[];

    get name(): string;

    get parent(): string;
}
