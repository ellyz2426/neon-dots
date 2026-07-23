import { ReadonlySignal } from '@preact/signals-core';
import { ColorRepresentation } from './utils.js';
export type PreferredColorScheme = 'dark' | 'light' | 'system';
export declare const isDarkMode: ReadonlySignal<boolean>;
export declare function setPreferredColorScheme(scheme: PreferredColorScheme): void;
export declare function getPreferredColorScheme(): PreferredColorScheme;
export declare function basedOnPreferredColorScheme<const T extends {
    [Key in string]: ColorRepresentation;
}>({ dark, light, }: {
    dark: T;
    light: T;
}): { [Key in keyof T]: ReadonlySignal<ColorRepresentation>; };
