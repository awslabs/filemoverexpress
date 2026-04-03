import { Bookmark as IBookmark } from './bookmarks.interfaces';

export class Bookmark implements IBookmark {
    encryption = false;
    host = '';
    name = '';
    port = 0;
    pre_shared_key = '';
    favoritePaths: string[] = [];
    onConnectStartingPath: string | null = null;

    constructor(values: IBookmark) {
        Object.assign(this, values);
    }

    get address(): string {
        return `${this.encryption ? 'https' : 'http'}://${this.host}:${this.port}`;
    }
}
