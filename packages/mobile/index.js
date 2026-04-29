// Custom entry point — bypasses expo/AppEntry.js which breaks in monorepos
// (expo/AppEntry.js does ../../App relative to hoisted node_modules, missing packages/mobile)
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
