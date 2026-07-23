export declare const LayersSectionSize: number;
declare const SectionStartIndexMap: {
    important: number;
    placeholderStyle: number;
    focus: number;
    active: number;
    hover: number;
    dark: number;
    '2xl': number;
    xl: number;
    lg: number;
    md: number;
    sm: number;
    base: number;
};
export declare const SpecialLayerSections: Array<Exclude<keyof typeof SectionStartIndexMap, "base">>;
export declare function getLayerIndex(identifier: LayerIdentifier): number;
export type LayerSection = keyof typeof SectionStartIndexMap;
export type LayerIdentifier = {
    type: 'inheritance' | 'star-inheritance';
} | (LayerInSectionIdentifier & {
    section: LayerSection;
});
export type LayerInSectionIdentifier = {
    type: 'class';
    classIndex: number;
} | {
    type: 'base' | 'default-overrides';
};
export {};
