import { SerializedDrawing } from "@/core/chart/drawings/types";
import { Candlestick } from "@/core/chart/market-data/types";

const DATABASE_NAME = "COCHART";
const DATABASE_VERSION = 1;
const DRAWINGS_STORENAME = "drawings";
const CANDLES_STORENAME = "candles";

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

            const store = database.createObjectStore(DRAWINGS_STORENAME, {
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
            const tx = database.transaction(DRAWINGS_STORENAME, "readwrite");
            const store = tx.objectStore(DRAWINGS_STORENAME)

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
            const transaction = database.transaction(DRAWINGS_STORENAME, "readonly");
            const store = transaction.objectStore(DRAWINGS_STORENAME);
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


export async function setCandles(chartId: string, candles: Candlestick[]): Promise<void> {
    if (!chartId || typeof chartId !== "string") {
        console.error("Invalid chartId");
        return;
    }

    try {
        const database = await ensureDatabase();

        return new Promise((resolve, reject) => {
            const tx = database.transaction(CANDLES_STORENAME, "readwrite");
            const store = tx.objectStore(CANDLES_STORENAME)

            const data = {
                chartId,
                candles,
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

export async function getCandles(chartId: string): Promise<Candlestick[]> {
    if (!chartId || typeof chartId !== "string") {
        console.error("Invalid chartId");
        return [];
    }
    try {
        const database = await ensureDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(CANDLES_STORENAME, "readonly");
            const store = transaction.objectStore(CANDLES_STORENAME);
            const request = store.get(chartId);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.candles) {
                    resolve(result.candles);
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
