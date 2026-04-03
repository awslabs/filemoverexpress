import { RegionList as IRegionList } from './regions.interfaces';

export class RegionList {
    lastUpdated: Date;
    regions: string[];

    constructor() {
        this.lastUpdated = new Date();
        this.regions = [];
    }

    add(region: string) {
        if (!this.regions.includes(region)) {
            this.regions.push(region);
        }
    }

    public static fromJson(obj: object): RegionList {
        const rl = new RegionList();
        try {
            const convertedObj = obj as IRegionList;
            rl.lastUpdated = new Date(Date.parse(convertedObj['lastUpdated']));
            rl.regions = convertedObj['regions'];
            return rl;
        } catch {
            return rl;
        }
    }
}
