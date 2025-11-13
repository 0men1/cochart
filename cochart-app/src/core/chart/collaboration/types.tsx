interface Operation {
	id: string;
	type: string;
	payload: any;
	version: number;      // Document version
	timestamp: number;    // Lamport timestamp
	clientId: string;
}

