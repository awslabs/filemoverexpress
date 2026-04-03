import { Bookmark } from './bookmarks.classes';

const UNENCRYPTED = {
    encryption: false,
    host: '127.0.0.1',
    name: 'unencrypted',
    port: 50009,
    pre_shared_key: '',
    favoritePaths: ['/Users/me/Desktop'],
    onConnectStartingPath: null,
};
const ENCRYPTED = {
    encryption: true,
    host: '127.0.0.1',
    name: 'encrypted',
    port: 50001,
    pre_shared_key: '',
    favoritePaths: ['/Users/me/Desktop'],
    onConnectStartingPath: '/Users/me',
};

describe('Bookmark', () => {
    it('should create an instance', () => {
        const unencrypted = new Bookmark(UNENCRYPTED);
        const encrypted = new Bookmark(ENCRYPTED);

        expect(unencrypted).toBeTruthy();
        expect(encrypted).toBeTruthy();
    });
});
