export interface NavigateOptions {
    initialNavigation?: boolean;
    silentRefreshNavigation?: boolean;
}

export interface WailsFileList {
    files: Record<string,string>;
    targetId: string;
}
