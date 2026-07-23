import { BaseOutProperties, InProperties, Properties } from '../properties/index.js';
export declare const StyleSheet: Record<string, InProperties>;
export declare class ClassList {
    private readonly properties;
    private readonly starProperties;
    private list;
    constructor(properties: Properties, starProperties: Properties);
    [Symbol.iterator](): Generator<string, void, unknown>;
    set(...classes: typeof this.list): void;
    add(...classes: typeof this.list): void;
    remove(...classes: typeof this.list): void;
    toggle(classRef: (typeof this.list)[number]): void;
    contains(classRef: (typeof this.list)[number]): boolean;
    replace(oldToken: (typeof this.list)[number], newToken: (typeof this.list)[number]): boolean;
    private resolveClassRef;
}
export declare function getStarProperties<T extends BaseOutProperties>(properties: InProperties<T> | undefined): InProperties<T> | undefined;
