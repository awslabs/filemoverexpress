import { ObjectSortPipe } from './object-sort.pipe';

describe('ListSortPipe', () => {
    it('create an instance', () => {
        const pipe = new ObjectSortPipe();
        expect(pipe).toBeTruthy();
    });
});
