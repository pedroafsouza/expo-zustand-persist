

# zustand-expo-persist 
A lightweight middleware to enable persistence for [zustand](https://github.com/pmndrs/zustand)  state management in React Native and Expo applications. This package is inspired by [zustand/middleware](https://github.com/pmndrs/zustand)  and makes it easy to persist your app's state in local storage or similar storage mechanisms compatible with React Native and Expo.
## Features 

- Compatible with React Native and Expo

- Easy to set up and use with Zustand's store

- Allows seamless state persistence across app sessions

## Installation 

Install the package with npm:

```bash
npm install zustand-expo-persist zustand
```
 

## Getting Started 
To enable persistence with `zustand-expo-persist`, simply wrap your Zustand store with the middleware.
### Example Usage 
Here’s a basic setup of how to use `zustand-expo-persist` to persist your store:

```javascript
import { create } from 'zustand';
import { persist } from 'zustand-expo-persist';
import AsynStorage from '@react-native-async-storage/async-storage';

// Define your store as usual
const useStore = create(
  persist(
    (set) => ({
      counter: 0,
      increase: () => set((state) => ({ counter: state.counter + 1 })),
      reset: () => set({ counter: 0 }),
    }),
    {
      name: 'my-app-storage', // unique name for storage key
            storage: createJSONStorage(() => AsynStorage), // Using WmaStorage as the storage engine
    }
  )
);
```