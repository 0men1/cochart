import { SerializedDrawing } from "@/core/chart/drawings/types";
import { Candlestick } from "@/core/chart/market-data/types";

const DATABASE_NAME = "COCHART";
const DATABASE_VERSION = 2;
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


            const drawingStore = database.createObjectStore(DRAWINGS_STORENAME, {
                keyPath: "chartId"
            });
            drawingStore.createIndex("chartId", "chartId", { unique: true })

            const candleStore = database.createObjectStore(CANDLES_STORENAME, {
                keyPath: ["chartId", "time"]
            });

            candleStore.createIndex("chartId", "chartId", { unique: false })
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

            candles.forEach(candle => {
                store.put({ ...candle, chartId })
            })

            tx.oncomplete = () => { resolve(); }
            tx.onerror = () => { reject(tx.error); }
        })
    } catch (error) {
        console.error("Error storing drawings: ", error);
        throw error;
    }
}

export async function getCandlesRange(chartId: string, start: number, end: number): Promise<Candlestick[]> {
    const database = await ensureDatabase();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CANDLES_STORENAME, "readonly");
        const store = tx.objectStore(CANDLES_STORENAME);

        const range = IDBKeyRange.bound([chartId, start], [chartId, end]);
        const request = store.getAll(range);

        request.onsuccess = () => { resolve(request.result || []) };
        request.onerror = () => { reject(request.error) };
    })
}

export async function getLastCandleTime(chartId: string): Promise<number | null> {
    const database = await ensureDatabase();
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CANDLES_STORENAME, "readonly");
        const store = tx.objectStore(CANDLES_STORENAME);

        const cursorReq = store.openKeyCursor(
            IDBKeyRange.bound([chartId, -Infinity], [chartId, Infinity]),
            "prev"
        )
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
                resolve((cursor.key as any)[1]);
                return;
            }
            resolve(null);
        }
        cursorReq.onerror = () => { reject(cursorReq.error) };
    })

}
