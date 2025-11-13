import { SerializedDrawing } from "@/core/chart/drawings/types";

const DATABASE_NAME = "COCHART_DRAWINGS";
const DATABASE_VERSION = 1;
const STORE_NAME = "drawings";

let db: IDBDatabase;
let dbInitPromise: Promise<IDBDatabase> | null = null;

function initDatabase(): Promise<IDBDatabase> {
    if (dbInitPromise) {
        return dbInitPromise;
    }

    dbInitPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onerror = (error: Event) => {
            console.error(error);
            reject(request.error);
        }

        request.onsuccess = () => {
            db = request.result;
            resolve(db)
        }

        request.onupgradeneeded = () => {
            const database = request.result;

            const store = database.createObjectStore(STORE_NAME, {
                keyPath: "chartId"
            });
            store.createIndex("by_chart_id", "chartId", { unique: true })
            store.createIndex("by_timestamp", "timestamp")
        }

        request.onblocked = () => {
            console.warn("Database upgrade blocked.")
        }
    })

    return dbInitPromise;
}

async function ensureDatabase(): Promise<IDBDatabase> {
    if (db) return db;
    return await initDatabase();
}

export async function setDrawings(chartId: string, drawings: SerializedDrawing[]): Promise<void> {
    if (!chartId || typeof chartId !== "string") {
        console.error("Invalid chartId");
        return;
    }

    try {
        const database = await ensureDatabase();

        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME)

            const data = {
                chartId,
                drawings,
                timestamp: Date.now(),
                lastModified: new Date().toISOString()
            }

            const request = store.put(data)

            request.onsuccess = () => {
                console.log("Successfully set drawings")
                resolve();
            }

            request.onerror = () => {
                console.error("Failed to store drawings: ", request.error)
                reject(request.error);
            }
            tx.onerror = () => {
                console.error("Transaction error: ", tx.error);
                reject(tx.error);
            }
        })
    } catch (error) {
        console.error("Error storing drawings: ", error);
        throw error;
    }
}

export async function getDrawings(chartId: string): Promise<SerializedDrawing[]> {
    if (!chartId || typeof chartId !== "string") {
        console.error("Invalid chartId");
        return [];
    }
    try {
        const database = await ensureDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(chartId);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.drawings) {
                    resolve(result.drawings);
                } else {
                    resolve([]);
                }
            };

            request.onerror = () => {
                console.error("Failed to retrieve drawings: ", request.error);
                reject(request.error);
            }
        })

    } catch (error) {
        console.error("Error getting drawings: ", error)
        throw error;
    }
}
