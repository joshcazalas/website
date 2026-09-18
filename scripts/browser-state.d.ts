import type { FactoryDebugState } from '../src/factory-debug';

declare global {
  interface Window {
    readonly __factory: FactoryDebugState;
    __menuLoadingSnapshot?: { phase: string | undefined; loadingVisible: boolean; shellHidden: boolean; shellInert: boolean };
  }
}
