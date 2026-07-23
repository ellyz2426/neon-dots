import { Signal } from '@preact/signals-core';
import { EventHandlersProperties } from './events.js';
import { Properties } from './properties/index.js';
export declare function setupCursorCleanup(hoveredSignal: Signal<Array<number>>, abortSignal: AbortSignal): void;
/**
 * must be executed inside effect/computed
 */
export declare function addHoverHandlers(target: EventHandlersProperties, properties: Properties, hoveredSignal: Signal<Array<number>>, hasHoverConditionalInProperties: Signal<boolean>, hasHoverConditionalInStarProperties: Signal<boolean>): void;
