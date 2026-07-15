export function createSceneManager() {
  /** @type {{ name: string, enter?: (data?: any) => void, exit?: () => void, update?: (dt: number, input: any) => void, render?: (ctx: CanvasRenderingContext2D, r: any) => void } | null} */
  let current = null;
  let currentName = '';

  return {
    get name() {
      return currentName;
    },
    get scene() {
      return current;
    },
    /**
     * @param {string} name
     * @param {object} scene
     * @param {any} [data]
     */
    set(name, scene, data) {
      current?.exit?.();
      current = scene;
      currentName = name;
      current?.enter?.(data);
    },
    update(dt, input) {
      current?.update?.(dt, input);
    },
    render(ctx, renderer) {
      current?.render?.(ctx, renderer);
    },
  };
}
