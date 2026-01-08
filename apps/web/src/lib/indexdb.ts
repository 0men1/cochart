import { BaseDrawing } from "@/core/chart/drawings/primitives/BaseDrawing";
import { SerializedDrawing } from "@/core/chart/drawings/types";

const DATABASE_NAME = "COCHART";
const DATABASE_VERSION = 2;
const DRAWINGS_STORENAME = "drawings";

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
			const db = request.result;

			const drawingStore = db.createObjectStore(DRAWINGS_STORENAME, {
				keyPath: "chartId"
			});
			drawingStore.createIndex("chartId", "chartId", { unique: true })
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

export async function setDrawings(chartId: string, drawings: BaseDrawing[]): Promise<void> {
	if (!chartId || typeof chartId !== "string") {
		console.error("Invalid chartId");
		return;
	}

	try {
		const database = await ensureDatabase();

		return new Promise((resolve, reject) => {
			const tx = database.transaction(DRAWINGS_STORENAME, "readwrite");
			const store = tx.objectStore(DRAWINGS_STORENAME)

			const serialized_drawings = drawings.map(d => d.serialize());

			const data = {
				chartId,
				drawings: serialized_drawings,
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
