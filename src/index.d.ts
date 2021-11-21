export function getProjectRoot (name?: string, cwd?: string): Promise<{ baseDir: string, cacheDir: string }>;

export class FSCache {
	constructor (options: FSCacheOptions);
	get<T extends CacheResult> (filename: string, key: any[], loader: Loader<T>): Promise<T>;
}

type Promisable<T> = T | Promise<T>;

export type Loader<T extends CacheResult> = () => Promisable<T>;

export interface CacheResult {
	dependencies?: string[];
	[key: string]: any;
}

export interface FSCacheOptions {
	baseDir: string;
	cacheDir: string;
}
