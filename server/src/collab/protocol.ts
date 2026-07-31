// The collaboration wire protocol now lives in @cochart/protocol so the app
// and server share one source of truth. Re-exported here so existing
// `./protocol` imports across the server keep working unchanged.
export * from "@cochart/protocol";
