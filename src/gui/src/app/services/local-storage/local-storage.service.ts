import { Injectable } from '@angular/core';
import { StorageServiceError, StorageServiceErrorType } from '@app/classes/errors';
import { LSData, LSDataValue } from './local-storage.interfaces';

@Injectable({
    providedIn: 'root',
})
export class LocalStorageService {
    private readonly ls: Storage;
    private readonly validStorageTypes: string[] = [
        'string',
        'number',
        'boolean',
        'object',
    ];

    constructor() {
        this.ls = window.localStorage;
    }

    //region Private helper functions
    /**
     * Fetches a key from the local storage
     * @param {string} key - Key to retrieve
     * @returns {LSData} - Returns a LSData object for the given key
     * @throws {StorageServiceError} - Throws a StorageServiceError of type NoSuckKey if the key doesn't exist
     * @private
     */
    private getValue(key: string): LSData {
        const val = this.ls.getItem(key);
        if (val === null) {
            throw new StorageServiceError('No such key has been set', StorageServiceErrorType.NoSuchKey);
        }

        return JSON.parse(val);
    }

    //endregion

    /**
     * Stores a value in the persistent storage system.
     * @param {string} key - Unique identifier to store object as. *Note* If the key already exists, it will be overwritten
     * @param {LSDataValue} value - Value to store. Must be one of the following types: string, number, boolean, object
     * @throws {StorageServiceError} - Throws a StorageServiceError if unable to store the value
     */
    set(key: string, value: LSDataValue): void {
        const valueType = typeof value;

        if (!this.validStorageTypes.includes(valueType)) {
            throw new StorageServiceError(
                `Invalid type: ${valueType}. Valid types: ${this.validStorageTypes.join(', ')}`,
                StorageServiceErrorType.InvalidType,
            );
        }

        try {
            const data = {
                type: valueType,
                value: value,
            };

            this.ls.setItem(key, JSON.stringify(data));
        } catch (e) {
            let errorMessage = `Error storing data with key ${key} into local storage`;
            if (e instanceof Error) {
                errorMessage = e.message;
            } else if (typeof e === 'string') {
                errorMessage = e;
            }
            throw new StorageServiceError(errorMessage, StorageServiceErrorType.JsonError);
        }
    }

    /**
     * Retrieves a string value
     *
     * @param {string} key - Key to retrieve
     * @param {string} defaultValue - Value to return, if object does not exist in local storage
     * @return {string} - Stored string value
     * @throws {StorageServiceError} - Returned if the stored value is unparsable or of incorrect type
     */
    getString(key: string, defaultValue?: string): string {
        let data;

        try {
            data = this.getValue(key);
        } catch (err) {
            if (err instanceof StorageServiceError && err.errorType === StorageServiceErrorType.NoSuchKey && defaultValue) {
                return defaultValue;
            }
            throw (err);
        }

        if (data.type !== 'string') {
            throw new StorageServiceError(`Requested key is not a string, but ${data.type}`, StorageServiceErrorType.InvalidType);
        }

        return data.value as string;
    }

    /**
     * Retrieves a numeric value
     * @param {string} key - Key to retrieve
     * @param {number} defaultValue - Value to return, if object does not exist in local storage
     * @return {number} - Returns the value associated with the key
     * @throws {StorageServiceError} - Returned if the stored value is unparsable or of incorrect type
     */
    getNumber(key: string, defaultValue?: number): number {
        let data;
        try {
            data = this.getValue(key);
        } catch (err) {
            if (err instanceof StorageServiceError && err.errorType === StorageServiceErrorType.NoSuchKey && defaultValue) {
                return defaultValue;
            }
            throw (err);
        }

        if (data.type !== 'number') {
            throw new StorageServiceError(`Requested key is not a number, but ${data.type}`, StorageServiceErrorType.InvalidType);
        }

        return data.value as number;
    }

    /**
     * Retrieves an object value
     * @param {string} key - Key to retrieve
     * @param {object} defaultValue - Value to return, if object does not exist in local storage
     * @return {object} - Returns the value associated with the key
     * @throws {StorageServiceError} - Returned if the stored value is unparsable or of incorrect type
     */
    getObject<T>(key: string, defaultValue?: T): T {
        let data;

        try {
            data = this.getValue(key);
        } catch (err) {
            if (err instanceof StorageServiceError && err.errorType === StorageServiceErrorType.NoSuchKey && defaultValue) {
                return defaultValue;
            }
            throw (err);
        }

        if (data.type !== 'object') {
            throw new StorageServiceError(`Requested key is not an object, but ${data.type}`, StorageServiceErrorType.InvalidType);
        }

        return data.value as T;
    }

    /**
     * Retrieves a numeric value
     * @param {string} key - Key to retrieve
     * @param {boolean} defaultValue - Value to return, if object does not exist in local storage
     * @return {boolean} - Returns the boolean value associated with the key
     * @throws {StorageServiceError} - Returned if the stored value is unparsable or of incorrect type
     */
    getBoolean(key: string, defaultValue?: boolean): boolean {
        let data;
        try {
            data = this.getValue(key);
        } catch (err) {
            if (err instanceof StorageServiceError && err.errorType === StorageServiceErrorType.NoSuchKey && defaultValue) {
                return defaultValue;
            }

            throw (err);
        }

        if (data.type !== 'boolean') {
            throw new StorageServiceError(`Requested key is not a boolean, but ${data.type}`, StorageServiceErrorType.InvalidType);
        }

        return data.value as boolean;
    }

    /**
     * Checks if a given key exists in the local storage
     * @param {string} key - Key to check if exists
     * @returns {boolean} - True if key exists, else false
     */
    exists(key: string): boolean {
        return this.ls.getItem(key) !== null;
    }
}
