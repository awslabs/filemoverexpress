import { FSFile } from './fsfile';
import { create } from '@bufbuild/protobuf';
import { TimestampSchema } from '@bufbuild/protobuf/wkt';
import { FsFileSchema } from '@gen/es/fme/v1/remote_daemon_pb';

describe('Fsfile', () => {
    it('should create an instance', () => {
        expect(new FSFile('/path/to/file', BigInt(1234), new Date())).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const ff = create(FsFileSchema);
        ff.path = '/path/to/file';
        ff.size = BigInt(1234);
        ff.lastModified = create(TimestampSchema);

        const evt = FSFile.fromProtobuf(ff);
        expect(evt).toBeTruthy();
    });
});
