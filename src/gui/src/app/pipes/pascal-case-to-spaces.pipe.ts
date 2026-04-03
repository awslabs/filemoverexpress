import { Pipe, PipeTransform } from '@angular/core';
import { pascalCaseToSpace } from '@app/utils/utils';

@Pipe({
    name: 'pascalCaseToSpaces',

})
export class PascalCaseToSpacesPipe implements PipeTransform {

    transform(value: string): string {
        return pascalCaseToSpace(value);
    }

}
