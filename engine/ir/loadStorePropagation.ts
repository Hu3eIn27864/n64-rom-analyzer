import { pointerLocation, type PointerExpression } from './pointerPropagation';

export interface MemoryAccessState {
  readonly locations: Readonly<Record<string, string>>;
}

export interface StoreAccess {
  readonly pointer: PointerExpression;
  readonly value: string;
}

export interface LoadAccess {
  readonly pointer: PointerExpression;
}

/** Record a store only when its address and value are proven. */
export function propagateStore(
  state: MemoryAccessState,
  store: StoreAccess,
): MemoryAccessState {
  const location = pointerLocation(store.pointer);
  const value = store.value.trim();
  if (!location) throw new Error('store requires a proven pointer location');
  if (!value) throw new Error(`store at ${location} requires a value`);

  return {
    locations: { ...state.locations, [location]: value },
  };
}

/** Resolve a load only when the pointer identifies one proven memory location. */
export function propagateLoad(
  state: MemoryAccessState,
  load: LoadAccess,
): string | undefined {
  const location = pointerLocation(load.pointer);
  if (!location) return undefined;
  return state.locations[location];
}
