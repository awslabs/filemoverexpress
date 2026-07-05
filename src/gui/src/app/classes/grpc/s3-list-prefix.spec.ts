import { describe, it, expect } from 'vitest';
import { S3ListPrefix } from './s3-list-prefix';
import { create } from '@bufbuild/protobuf';
import { S3ListPrefixResponseSchema, S3ObjectSchema } from '@gen/es/s3_shared/v1/s3_pb';

const data = {
    prefix: '',
    prefixes: [
        'folder1',
        'folder2',
        'folder3',
    ],
    objects: [
        {
            path: 'file1',
            size: BigInt(1234),
            lastModified: new Date(),
            name: '',
            parent: '',
            storageClass: 'STANDARD',
        },
    ],
};

describe('S3ListPath', () => {
    it('should create an instance', () => {
        expect(new S3ListPrefix(
            data.prefix,
            data.prefixes,
            data.objects,
        )).toBeTruthy();
    });

    it('should convert from protobuf', () => {
        const pbEvt = create(S3ListPrefixResponseSchema);
        const objects = [];
        for (const obj of data.objects) {
            const pbObj = create(S3ObjectSchema);
            pbObj.key = obj.path;
            pbObj.size = obj.size;

            objects.push(pbObj);
        }

        pbEvt.prefix = data.prefix;
        pbEvt.prefixes = data.prefixes;
        pbEvt.objects = objects;

        const evt = S3ListPrefix.fromProtobuf(pbEvt);

        expect(evt).toBeTruthy();
        expect(evt.folders.length).toBe(3);
        expect(evt.files.length).toBe(1);
    });
});
