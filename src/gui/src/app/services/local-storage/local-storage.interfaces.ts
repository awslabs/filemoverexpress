export interface LSData {
    type: string;
    value: LSDataValue;
}

export type LSDataValue = string | number | boolean | object;
