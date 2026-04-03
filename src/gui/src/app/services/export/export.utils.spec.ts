import * as exportUtils from '@services/export/export.utils';
import { ExportJobList } from '@services/export/export.interfaces';
import {
    emptyJobsCaseInput,
    emptyTasksCaseInput,
    missingDataCaseInput,
    mixedJobsCaseInput,
    oneJobCaseInput,
    twoJobsCaseInput,
    withCommasDataCaseInput,
} from '@services/export/export-tests-constants/export-test-case-inputs.constants';
import {
    csvEmptyJobsCaseExpected,
    csvMissingDataCaseExpected,
    csvMixedJobsCaseExpected,
    csvOneJobCaseExpected,
    csvTwoJobsCaseExpected,
    csvWithCommasDataCaseExpected,
} from '@services/export/export-tests-constants/csv-expected.constants';
import {
    jsonEmptyJobsCaseExpected,
    jsonEmptyTasksCaseExpected,
    jsonMissingDataCaseExpected,
    jsonMixedJobsCaseExpected,
    jsonOneJobCaseExpected,
    jsonTwoJobsCaseExpected,
    jsonWithCommasDataCaseExpected,
} from '@services/export/export-tests-constants/json-expected.constants';

describe('[exportUtils] convertTransfersToCsv', () => {
    const emptyJobsCase: [ExportJobList, string] = [emptyJobsCaseInput, csvEmptyJobsCaseExpected];
    const emptyTasksCase: [ExportJobList, string] = [emptyTasksCaseInput, csvEmptyJobsCaseExpected];
    const oneJobCase: [ExportJobList, string] = [oneJobCaseInput, csvOneJobCaseExpected];
    const twoJobsCase: [ExportJobList, string] = [twoJobsCaseInput, csvTwoJobsCaseExpected];
    const mixedJobsCase: [ExportJobList, string] = [mixedJobsCaseInput, csvMixedJobsCaseExpected];
    const missingDataCase: [ExportJobList, string] = [missingDataCaseInput, csvMissingDataCaseExpected];
    const withCommasDataCase: [ExportJobList, string] = [withCommasDataCaseInput, csvWithCommasDataCaseExpected];

    const testCases: Record<string, [ExportJobList, string]> = {
        'should correctly generate CSV with empty job list': emptyJobsCase,
        'should correctly generate CSV with job list with no tasks': emptyTasksCase,
        'should correctly generate CSV with job list of one job': oneJobCase,
        'should correctly generate CSV with job list of two jobs': twoJobsCase,
        'should correctly generate CSV with job list of >2 jobs with uploads and downloads': mixedJobsCase,
        'should correctly generate CSV with job list that has missing data': missingDataCase,
        'should correctly generate CSV with job list that has commas in cell values by wrapping text call values in double quotes': withCommasDataCase,
    };

    for (const testDescription of Object.keys(testCases)) {
        it(testDescription, () => {
            const encodedResult = exportUtils.convertTransfersToCsv(testCases[testDescription][0]);
            expect(atob(encodedResult)).toBe(testCases[testDescription][1]);
        });
    }
});

describe('[exportUtils] convertTransfersToJson', () => {
    const emptyJobsCase: [ExportJobList, string] = [emptyJobsCaseInput, jsonEmptyJobsCaseExpected];
    const emptyTasksCase: [ExportJobList, string] = [emptyTasksCaseInput, jsonEmptyTasksCaseExpected];
    const oneJobCase: [ExportJobList, string] = [oneJobCaseInput, jsonOneJobCaseExpected];
    const twoJobsCase: [ExportJobList, string] = [twoJobsCaseInput, jsonTwoJobsCaseExpected];
    const mixedJobsCase: [ExportJobList, string] = [mixedJobsCaseInput, jsonMixedJobsCaseExpected];
    const missingDataCase: [ExportJobList, string] = [missingDataCaseInput, jsonMissingDataCaseExpected];
    const withCommasDataCase: [ExportJobList, string] = [withCommasDataCaseInput, jsonWithCommasDataCaseExpected];

    const testCases: Record<string, [ExportJobList, string]> = {
        'should correctly generate JSON with empty job list': emptyJobsCase,
        'should correctly generate JSON with job list with no tasks': emptyTasksCase,
        'should correctly generate JSON with job list of one job': oneJobCase,
        'should correctly generate JSON with job list of two jobs': twoJobsCase,
        'should correctly generate JSON with job list of >2 jobs with uploads and downloads': mixedJobsCase,
        'should correctly generate JSON with job list that has missing data': missingDataCase,
        'should correctly generate JSON with job list that has commas in values': withCommasDataCase,
    };

    for (const testDescription of Object.keys(testCases)) {
        it(testDescription, () => {
            const encodedResult = exportUtils.convertTransfersToJson(testCases[testDescription][0]);
            expect(atob(encodedResult)).toBe(testCases[testDescription][1]);
        });
    }
});

describe('[exportUtils] convertTransfersToExcel', () => {
    const emptyTestCases: Record<string, ExportJobList> = {
        'should not error when generating Excel sheet with empty job list': emptyJobsCaseInput,
    };
    const nonEmptyTestCases: Record<string, ExportJobList> = {
        'should not error when generating Excel sheet with no tasks': emptyTasksCaseInput,
        'should not error when generating Excel sheet with job list of one job': oneJobCaseInput,
        'should not error when generating Excel sheet with job list of two jobs': twoJobsCaseInput,
        'should not error when generating Excel sheet with job list of >2 jobs with uploads and downloads': mixedJobsCaseInput,
        'should not error when generating Excel sheet with job list that has missing data': missingDataCaseInput,
        'should not error when generating Excel sheet with job list that has commas in values': withCommasDataCaseInput,
    };

    for (const testDescription of Object.keys(emptyTestCases)) {
        it(testDescription, () => {
            const result = exportUtils.convertTransfersToExcel(emptyTestCases[testDescription]);
            expect(result).toBe('');
        });
    }

    for (const testDescription of Object.keys(nonEmptyTestCases)) {
        it(testDescription, () => {
            const result = exportUtils.convertTransfersToExcel(nonEmptyTestCases[testDescription]);
            expect(result).not.toBe('');
        });
    }
});
