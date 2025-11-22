/**
 * Utility functions for file operations
 */

/**
 * Trigger a browser download for a Blob
 * @param blob The blob to download
 * @param filename The name of the file to save as
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Generate a filename for vault export with timestamp
 * @param vaultName The name of the vault
 * @returns Sanitized filename with timestamp
 */
export function generateExportFilename(vaultName: string): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const sanitizedName = vaultName.replace(/[^a-z0-9]/gi, '_');
	return `${sanitizedName}-${timestamp}.gullvault`;
}

/**
 * Read a file as a Blob
 * @param file The File object to read
 * @returns Promise resolving to Blob
 */
export function readFileAsBlob(file: File): Promise<Blob> {
	return Promise.resolve(file);
}
