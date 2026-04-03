import { Pipe, PipeTransform } from '@angular/core';
import { basename } from '@app/utils/utils';

const TYPE_MAP: Record<string, { icon: string, extensions: string[] }> = {
    'audio': {
        icon: 'audio_file',
        extensions: [
            'amr',
            'awb',
            'axa',
            'au',
            'snd',
            'csd',
            'orc',
            'sco',
            'flac',
            'mid',
            'midi',
            'kar',
            'mpga',
            'mpega',
            'mp2',
            'mp3',
            'm4a',
            'm3u',
            'oga',
            'ogg',
            'opus',
            'spx',
            'sid',
            'aif',
            'aiff',
            'aifc',
            'gsm',
            'm3u',
            'wma',
            'wax',
            'ra',
            'rm',
            'ram',
            'ra',
            'pls',
            'sd2',
            'wav',
        ],
    },
    'image': {
        icon: 'image',
        extensions: [
            'gif',
            'ief',
            'jp2',
            'jpg2',
            'jpeg',
            'jpg',
            'jpe',
            'jpm',
            'jpx',
            'jpf',
            'pcx',
            'png',
            'svg',
            'svgz',
            'tiff',
            'tif',
            'djvu',
            'djv',
            'ico',
            'wbmp',
            'cr2',
            'crw',
            'ras',
            'cdr',
            'pat',
            'cdt',
            'cpt',
            'erf',
            'art',
            'jng',
            'bmp',
            'nef',
            'orf',
            'psd',
            'pnm',
            'pbm',
            'pgm',
            'ppm',
            'rgb',
            'xbm',
            'xpm',
            'xwd',
        ],
    },
    'video': {
        icon: 'video_file',
        extensions: [
            '3gp',
            'axv',
            'dl',
            'dif',
            'dv',
            'fli',
            'gl',
            'mpeg',
            'mpg',
            'mpe',
            'ts',
            'mp4',
            'qt',
            'mov',
            'ogv',
            'webm',
            'mxu',
            'flv',
            'lsf',
            'lsx',
            'mng',
            'asf',
            'asx',
            'wm',
            'wmv',
            'wmx',
            'wvx',
            'avi',
            'movie',
            'mpv',
            'mkv',
        ],
    },
};

@Pipe({
    name: 'fileIcon',

})
export class FileIconPipe implements PipeTransform {
    transform(value: string): string {
        const f = basename(value);
        const extPos = f.lastIndexOf('.');
        if (extPos) {
            const ext = f.substring(extPos + 1);
            for (const data of Object.values(TYPE_MAP)) {
                if (data.extensions.includes(ext)) {
                    return data.icon;
                }
            }
        }

        return 'text_snippet';
    }
}
