import { FSFolder } from './fsfolder';
import { create } from '@bufbuild/protobuf';
import { FsFolderSchema } from '@gen/es/fme/v1/remote_daemon_pb';

describe('Fsfolder', () => {
    it('should create an instance', () => {
        expect(new FSFolder('/path/to/folder', [], [])).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(FsFolderSchema);
        pbEvt.path = '/path/to/folder';
        pbEvt.folders = [];
        pbEvt.files = [];
        pbEvt.success = true;

        const evt = FSFolder.fromProtobuf(pbEvt);
        expect(evt).toBeTruthy();
    });
});
