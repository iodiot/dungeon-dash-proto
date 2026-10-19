/// <reference types="vite/client" />

interface Navigator {
  gpu?: GPU;
}

interface GPU {
  requestAdapter?: () => Promise<unknown>;
}
