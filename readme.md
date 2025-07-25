

# expo-zustand-persist 
A lightweight middleware to enable persistence for [zustand](https://github.com/pmndrs/zustand)  state management in React Native and Expo applications. This package is inspired by [zustand/middleware](https://github.com/pmndrs/zustand)  and makes it easy to persist your app's state in local storage or similar storage mechanisms compatible with React Native and Expo.
## Features 

- Compatible with React Native and Expo

- Easy to set up and use with Zustand's store

- Allows seamless state persistence across app sessions

## Installation 

Install the package with npm:

```bash
npm install expo-zustand-persist zustand
```
 

## Getting Started 
To enable persistence with `expo-zustand-persist`, simply wrap your Zustand store with the middleware.
### Example Usage 
Here’s a basic setup of how to use `expo-zustand-persist` to persist your store:

```typescript
import { create } from 'zustand';
import { createJSONStorage, persist } from 'expo-zustand-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Store = {
  counter: number;
  increase: () => void;
  reset: () => void;
};

// Define your store as usual
const useStore = create<Store>(
  persist(
    (set) => ({
      counter: 0,
      increase: () => set((state) => ({ counter: state.counter + 1 })),
      reset: () => set({ counter: 0 }),
    }),
    {
      name: 'my-app-storage', // unique name for storage key
      storage: createJSONStorage(() => AsyncStorage), // Using WmaStorage as the storage engine
    }
  )
);
```
