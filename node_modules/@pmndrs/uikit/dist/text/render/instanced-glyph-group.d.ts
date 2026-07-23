import { InstancedBufferAttribute } from 'three';
import { InstancedGlyph } from './instanced-glyph.js';
import { Font } from '../font.js';
import { OrderInfo } from '../../order.js';
import { RootContext } from '../../context.js';
import type { Component } from '../../components/component.js';
export declare class GlyphGroupManager {
    private readonly root;
    private readonly object;
    private map;
    constructor(root: Omit<RootContext, 'glyphGroupManager' | 'panelGroupManager'>, object: Component);
    init(abortSignal: AbortSignal): void;
    private traverse;
    getGroup({ majorIndex, minorIndex }: OrderInfo, depthTest: boolean, depthWrite: boolean, renderOrder: number, font: Font): InstancedGlyphGroup;
}
export declare class InstancedGlyphGroup {
    private object;
    readonly root: Omit<RootContext, 'glyphGroupManager' | 'panelGroupManager'>;
    private orderInfo;
    private renderOrder;
    instanceMatrix: InstancedBufferAttribute;
    instanceUV: InstancedBufferAttribute;
    instanceRGBA: InstancedBufferAttribute;
    instanceClipping: InstancedBufferAttribute;
    instanceRenderSolid: InstancedBufferAttribute;
    private glyphs;
    private requestedGlyphs;
    private holeIndicies;
    private mesh?;
    private instanceMaterial;
    private timeTillDecimate?;
    constructor(object: Component, font: Font, root: Omit<RootContext, 'glyphGroupManager' | 'panelGroupManager'>, orderInfo: OrderInfo, depthTest: boolean, depthWrite: boolean, renderOrder: number);
    requestActivate(glyph: InstancedGlyph): void;
    delete(glyph: InstancedGlyph): void;
    onFrame(delta: number): void;
    private resize;
    destroy(): void;
}
