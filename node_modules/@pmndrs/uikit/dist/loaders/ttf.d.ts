import type { GenerateFontResult, MSDFGeneratorOptions } from '@zappar/msdf-generator';
import { Loader, LoadingManager } from 'three';
export type MSDFResult = GenerateFontResult;
export interface TTFLoaderOptions extends Partial<Omit<MSDFGeneratorOptions, 'font'>> {
    url?: string;
    onProgress?: (progress: number, completed: number, total: number) => void;
}
export type TTFInputItem = string | (TTFLoaderOptions & {
    url: string;
});
export type TTFInput = string | TTFInputItem[];
export declare class TTFLoader extends Loader<MSDFResult, TTFInput> {
    constructor(manager?: LoadingManager);
    load(input: TTFInput, onLoad: (data: MSDFResult) => void, onProgress?: (event: ProgressEvent) => void, onError?: (err: unknown) => void): void;
    loadAsync(input: TTFInput, onProgress?: (event: ProgressEvent) => void): Promise<MSDFResult>;
    private _loadFontFiles;
    private _generate;
}
