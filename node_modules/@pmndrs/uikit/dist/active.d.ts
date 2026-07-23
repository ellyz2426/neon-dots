import { Signal } from '@preact/signals-core';
import { Properties } from './properties/index.js';
import { EventHandlersProperties } from './events.js';
/**
 * must be executed inside effect/computed
 */
export declare function addActiveHandlers(target: EventHandlersProperties, properties: Properties, activeSignal: Signal<Array<number>>, hasActiveConditionalInProperties: Signal<boolean>, hasActiveConditionalInStarProperties: Signal<boolean>): void;
