const DATABASE = "nuevauno-pos";
const STORE = "operations";

export interface OfflinePosOperation {
  id: string;
  scope: string;
  payload: unknown;
  createdAt: string;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function queuePosOperation(operation: OfflinePosOperation) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(operation);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  db.close();
}

export async function listPosOperations(scope: string) {
  const db = await database();
  const operations = await new Promise<OfflinePosOperation[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.addEventListener("success", () =>
      resolve(
        (request.result as OfflinePosOperation[])
          .filter((operation) => operation.scope === scope)
          .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt)),
      ),
    );
    request.addEventListener("error", () => reject(request.error));
  });
  db.close();
  return operations;
}

export async function removePosOperation(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  db.close();
}
