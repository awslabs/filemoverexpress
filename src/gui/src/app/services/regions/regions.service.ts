import { inject, Injectable } from '@angular/core';
import { LocalStorageService } from '../local-storage/local-storage.service';
import { Observable, ReplaySubject } from 'rxjs';
import { RegionList } from './regions.classes';
import { DayInMilliseconds, REGION_LIST_URL, RegionServiceCacheKey } from './regions.constants';

@Injectable({
    providedIn: 'root',
})
export class RegionsService {
    private storageService = inject(LocalStorageService);

    private _regions$: ReplaySubject<string[]>;
    private regionList: RegionList = new RegionList();

    constructor() {
        this._regions$ = new ReplaySubject<string[]>(1);
        if (this.storageService.exists(RegionServiceCacheKey)) {
            this.regionList = this.storageService.getObject(RegionServiceCacheKey) as RegionList;
            this._regions$.next(this.getRegions());
        }

        this.updateRegions();
    }

    private updateRegions() {
        if (this.storageService.exists(RegionServiceCacheKey)) {
            const cached = RegionList.fromJson(this.storageService.getObject(RegionServiceCacheKey));
            const now = new Date().getTime();
            const cachedTimestamp = cached.lastUpdated.getTime();

            if ((now - cachedTimestamp) < DayInMilliseconds) {
                this.regionList = cached;
                this._regions$.next(this.getRegions());
                return;
            }
        }

        fetch(REGION_LIST_URL).then(
            (response) => {
                response.json().then((data) => {
                    const newRegions = new RegionList();

                    for (const pfx of data.prefixes) {
                        const rgn = pfx['region'];
                        if (rgn !== 'GLOBAL') {
                            newRegions.add(pfx['region']);
                        }
                    }

                    this.regionList = newRegions;
                    this._regions$.next(this.getRegions());
                    this.storageService.set(RegionServiceCacheKey, this.regionList);
                });
            },
            (err) => {
                console.log(`An error occured while fetching ip-ranges.json: ${err}`);
            },
        );
    }

    get regions$(): Observable<string[]> {
        return this._regions$.asObservable();
    }

    getRegions(): string[] {
        if (this.regionList) {
            return this.regionList.regions.sort();
        }

        return [];
    }
}
