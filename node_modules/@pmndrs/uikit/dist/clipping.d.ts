import { Signal } from '@preact/signals-core';
import { Matrix4, Plane } from 'three';
import type { Vector2Tuple } from 'three';
import { Container } from './components/container.js';
import { Component } from './components/component.js';
import { Fix_TS_56_Float32Array } from './utils.js';
export declare class ClippingRect {
    readonly planes: Array<Plane>;
    private readonly facePlane;
    private readonly originalCenter;
    constructor(globalMatrix: Matrix4, centerX: number, centerY: number, width: number, height: number);
    min({ planes }: ClippingRect): this;
    toArray(array: ArrayLike<number>, offset: number): void;
}
export declare function computedIsClipped(parent: Signal<Container | undefined>, globalMatrix: Signal<Matrix4 | undefined>, size: Signal<Vector2Tuple | undefined>, pixelSizeSignal: Signal<number>): Signal<boolean>;
export declare function computedClippingRect(globalMatrix: Signal<Matrix4 | undefined>, { overflow, borderInset, size }: Component, pixelSizeSignal: Signal<number>, parentClippingRect: Signal<ClippingRect | undefined> | undefined): Signal<ClippingRect | undefined>;
export declare const NoClippingPlane: Plane;
export declare const defaultClippingData: Fix_TS_56_Float32Array;
export declare function createGlobalClippingPlanes(component: Component): Plane[];
