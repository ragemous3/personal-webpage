export const modelDescriptors = [
  {
    id: 'Xenova/Qwen1.5-0.5B-Chat',
    label: 'Qwen1.5 0.5B Chat',
    revision: '340777bb38067a8a5af921a405e3206a8cc2f318',
    precision: 'q4',
  },
];
export const metadata = {
  models: modelDescriptors,
  async load(model) {
    return {
      model,
      revision: modelDescriptors[0].revision,
      precisions: ['fp32', 'q4'],
      autoPrecision: { auto: 'fp32', wasm: 'q8', webgpu: 'fp32' },
    };
  },
};
