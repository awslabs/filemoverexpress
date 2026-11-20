import { AscMhlResult } from '@gen/es/fme/v1/job_pb';

/**
 * ASC MHL verification outcome carried on a job event. Undefined when the job
 * verified no supplied manifest, so the common case carries no ASC MHL data.
 */
export interface AscMhlEventData {
    verified: number;
    listed: number;
    problems: number;
    algorithm: string;
    failures: string[];
}

/**
 * Map the generated protobuf AscMhlResult onto the domain shape, or undefined
 * when the event carried no ASC MHL payload.
 *
 * @param {AscMhlResult | undefined} asc The protobuf message, if present.
 * @returns {AscMhlEventData | undefined} The domain payload, or undefined.
 */
export function ascMhlFromProtobuf(asc: AscMhlResult | undefined): AscMhlEventData | undefined {
    if (!asc) {
        return undefined;
    }
    return {
        verified: asc.verified,
        listed: asc.listed,
        problems: asc.problems,
        algorithm: asc.algorithm,
        failures: asc.failures,
    };
}
