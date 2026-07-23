import { Signal } from '@preact/signals-core';
import { RootContext } from '../context.js';
import type { SpecialLayerSections } from './layer.js';
export type Conditionals = Record<Exclude<(typeof SpecialLayerSections)[number], 'important'>, () => boolean>;
declare const breakPoints: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
};
type WithResponsive<T> = T & {
    [Key in keyof typeof breakPoints]?: T;
};
type WithHover<T> = T & {
    hover?: T;
};
type WithActive<T> = T & {
    active?: T;
};
type WithPreferredColorScheme<T> = {
    dark?: T;
} & T;
type WithFocus<T> = T & {
    focus?: T;
};
type WithPlaceholderStyle<T> = T & {
    placeholderStyle?: T;
};
export type WithImportant<T> = T & {
    important?: T;
};
export type WithConditionalsAndImportant<T> = WithHover<T> & WithResponsive<T> & WithPreferredColorScheme<T> & WithActive<T> & WithFocus<T> & WithImportant<T> & WithPlaceholderStyle<T>;
export declare const conditionalKeys: string[];
export declare function createConditionals(root: Signal<RootContext>, hoveredSignal: Signal<Array<number>>, activeSignal: Signal<Array<number>>, hasFocusSignal?: Signal<boolean>, isPlaceholderSignal?: Signal<boolean>): Conditionals;
export {};
