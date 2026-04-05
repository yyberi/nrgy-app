/// <reference types="vite/client" />
/// <reference path="./src/types/vue-grid-layout-v3.d.ts" />

declare module '*.vue' {
    import { DefineComponent } from 'vue';
    const component: DefineComponent<{}, {}, any>;
    export default component;
}
