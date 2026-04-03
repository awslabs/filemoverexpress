import {Architecture, Platform} from './platform';

export interface BuildArgs {
    component: 'cli' | 'gui';
    target: string;
    options: BuildOptions;
}

export interface BuildOptions {
    archs?: Architecture[];
    platforms?: Platform[];
    production?: boolean;
    verbose?: boolean;
}
