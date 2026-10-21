import type { FlushableStorage } from "@/storage/repository";

export async function bootstrapMobileApplication(
  createStorage: () => Promise<FlushableStorage>,
  render: (storage: FlushableStorage) => void,
) {
  const storage = await createStorage();
  render(storage);
}
