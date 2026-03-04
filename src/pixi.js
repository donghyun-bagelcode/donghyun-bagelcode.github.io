export const getPixi = () => globalThis.PIXI ?? null;

export const waitForPixi = async (timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pixi = getPixi();
    if (pixi) {
      return pixi;
    }
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return null;
};
