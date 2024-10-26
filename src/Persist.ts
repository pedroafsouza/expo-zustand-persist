/* eslint-disable consistent-return */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Basic Imports for Types
import { StateCreator, StoreApi } from 'zustand';
// Define the StateStorage interface
export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => unknown | Promise<unknown>;
  removeItem: (name: string) => unknown | Promise<unknown>;
}

// Define the StorageValue type
export type StorageValue<S> = {
  state: S;
  version?: number;
};

// Define the PersistStorage interface
export interface PersistStorage<S> {
  getItem: (
    name: string,
  ) => StorageValue<S> | null | Promise<StorageValue<S> | null>;
  setItem: (name: string, value: StorageValue<S>) => unknown | Promise<unknown>;
  removeItem: (name: string) => unknown | Promise<unknown>;
}

// Define JsonStorageOptions type
export type JsonStorageOptions = {
  reviver?: (key: string, value: unknown) => unknown;
  replacer?: (key: string, value: unknown) => unknown;
};

// Create JSON Storage with fallback support
export function createJSONStorage<S>(
  getStorage: () => StateStorage,
  options?: JsonStorageOptions,
): PersistStorage<S> | undefined {
  let storage: StateStorage | undefined;
  try {
    storage = getStorage();
  } catch {
    return undefined;
  }

  return {
    getItem: (name) => {
      const parse = (str: string | null) =>
        str === null
          ? null
          : (JSON.parse(str, options?.reviver) as StorageValue<S>);
      const str = storage.getItem(name) ?? null;
      return str instanceof Promise ? str.then(parse) : parse(str);
    },
    setItem: (name, newValue) =>
      storage.setItem(name, JSON.stringify(newValue, options?.replacer)),
    removeItem: (name) => storage.removeItem(name),
  };
}

// Define the PersistOptions interface
export interface PersistOptions<S, PersistedState = S> {
  name: string;
  storage?: PersistStorage<PersistedState>;
  partialize?: (state: S) => PersistedState;
  onRehydrateStorage?: (
    state: S,
  ) => ((state?: S, error?: unknown) => void) | void;
  version?: number;
  migrate?: (
    persistedState: unknown,
    version: number,
  ) => PersistedState | Promise<PersistedState>;
  merge?: (persistedState: unknown, currentState: S) => S;
  skipHydration?: boolean;
}

// Define utility types
type PersistListener<S> = (state: S) => void;

type StorePersist<S, Ps> = {
  persist: {
    setOptions: (options: Partial<PersistOptions<S, Ps>>) => void;
    clearStorage: () => void;
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onHydrate: (fn: PersistListener<S>) => () => void;
    onFinishHydration: (fn: PersistListener<S>) => () => void;
    getOptions: () => Partial<PersistOptions<S, Ps>>;
  };
};

// A utility function to wrap a function as Thenable for Promise handling
type Thenable<Value> = {
  then<V>(
    onFulfilled: (value: Value) => V | Promise<V> | Thenable<V>,
  ): Thenable<V>;
  catch<V>(
    onRejected: (reason: Error) => V | Promise<V> | Thenable<V>,
  ): Thenable<V>;
};

const toThenable =
  <Result, Input>(
    fn: (input: Input) => Result | Promise<Result> | Thenable<Result>,
  ) =>
  (input: Input): Thenable<Result> => {
    try {
      const result = fn(input);
      return result instanceof Promise
        ? (result as Thenable<Result>)
        : {
            then: (onFulfilled) => toThenable(onFulfilled)(result as Result),
            catch: (_onRejected) => this as unknown as Thenable<any>,
          };
    } catch (e: any) {
      return {
        then: (_onFulfilled) => this as unknown as Thenable<any>,
        catch: (onRejected) => toThenable(onRejected)(e),
      };
    }
  };

// persistImpl function to handle persistent state storage
type PersistImpl = <T>(
  storeInitializer: StateCreator<T, [], []>,
  options: PersistOptions<T, T>,
) => StateCreator<T, [], []>;

const persistImpl: PersistImpl = (config, baseOptions) => (set, get, api) => {
  type S = ReturnType<typeof config>;
  let options = {
    storage: createJSONStorage<S>(() => localStorage),
    partialize: (state: S) => state,
    version: 0,
    merge: (persistedState: unknown, currentState: S) => ({
      ...currentState,
      ...(persistedState as object),
    }),
    ...baseOptions,
  };

  let hasHydrated = false;
  const hydrationListeners = new Set<PersistListener<S>>();
  const finishHydrationListeners = new Set<PersistListener<S>>();
  let storage = options.storage;

  if (!storage) {
    return config(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`,
        );
        set(...(args as Parameters<typeof set>));
      },
      get,
      api,
    );
  }

  const setItem = () => {
    const state = options.partialize({ ...get() });
    return (storage as PersistStorage<S>).setItem(options.name, {
      state,
      version: options.version,
    });
  };

  const savedSetState = api.setState;

  api.setState = (state, replace) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savedSetState(state, replace as any);
    void setItem();
  };

  const configResult = config(
    (...args) => {
      set(...(args as Parameters<typeof set>));
      void setItem();
    },
    get,
    api,
  );

  api.getInitialState = () => configResult;

  let stateFromStorage: S | undefined;

  const hydrate = () => {
    if (!storage) return;

    hasHydrated = false;
    hydrationListeners.forEach((cb) => cb(get() ?? configResult));

    const postRehydrationCallback =
      options.onRehydrateStorage?.(get() ?? configResult) || undefined;

    return toThenable(storage.getItem.bind(storage))(options.name)
      .then((deserializedStorageValue) => {
        if (deserializedStorageValue) {
         const newDeserializedObj: any = deserializedStorageValue;
          if (
            typeof newDeserializedObj.version === 'number' &&
            newDeserializedObj.version !== options.version
          ) {
            if (options.migrate) {
              return [
                true,
                options.migrate(
                    newDeserializedObj.state,
                    newDeserializedObj.version,
                ),
              ] as const;
            }
            console.error(
              `State loaded from storage couldn't be migrated since no migrate function was provided`,
            );
          } else {
            return [false, newDeserializedObj.state] as const;
          }
        }
        return [false, undefined] as const;
      })
      .then((migrationResult) => {
        const [migrated, migratedState] = migrationResult;
        stateFromStorage = options.merge(
          migratedState as S,
          get() ?? configResult,
        );

        set(stateFromStorage as S, true);
        if (migrated) {
          return setItem();
        }
      })
      .then(() => {
        postRehydrationCallback?.(stateFromStorage, undefined);

        stateFromStorage = get();
        hasHydrated = true;
        finishHydrationListeners.forEach((cb) => cb(stateFromStorage as S));
      })
      .catch((e: Error) => {
        postRehydrationCallback?.(undefined, e);
      });
  };

  (api as StoreApi<S> & StorePersist<S, S>).persist = {
    setOptions: (newOptions) => {
      options = {
        ...options,
        ...newOptions,
      };

      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    },
    clearStorage: () => {
      storage?.removeItem(options.name);
    },
    getOptions: () => options,
    rehydrate: () => hydrate() as Promise<void>,
    hasHydrated: () => hasHydrated,
    onHydrate: (cb) => {
      hydrationListeners.add(cb);
      return () => {
        hydrationListeners.delete(cb);
      };
    },
    onFinishHydration: (cb) => {
      finishHydrationListeners.add(cb);
      return () => {
        finishHydrationListeners.delete(cb);
      };
    },
  };

  if (!options.skipHydration) {
    hydrate();
  }

  return stateFromStorage || configResult;
};

export const persist = persistImpl as unknown as PersistImpl;
