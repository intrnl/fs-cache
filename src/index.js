import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import escalade from 'escalade';

import { hash } from '@intrnl/xxhash64';


export async function getProjectRoot (name = 'cache', cwd = path.resolve()) {
	const pkg = 'package.json';

	const root = await escalade(cwd, (_, names) => {
		return names.includes(pkg) && pkg;
	})

	const baseDir = root ? path.join(root, '..') : cwd;
	const cacheDir = path.join(baseDir, root ? 'node_modules' : '', '.cache', name);

	return { baseDir, cacheDir };
}


const VERSION = 0;

const writer = fileWriter();

export class FSCache {
	#baseDir;
	#cacheDir;

	constructor (options) {
		const { baseDir, cacheDir } = options;

		this.#baseDir = baseDir;
		this.#cacheDir = cacheDir;
	}

	async get (filename, key = [], loader) {
		const cached = await this.#read(filename, key);

		if (cached) {
			return cached;
		}

		const metadata = await this.#write(filename, key, loader);

		return metadata;
	}

	async #read (filename, key) {
		const cachePath = this.#getCachePath(filename, key);

		try {
			const source = await fs.readFile(cachePath, 'utf-8');
			const metadata = JSON.parse(source);

			const dependencies = metadata.dependencies;
			const arr = [];

			for (const dep in dependencies) {
				const pathname = path.join(this.#baseDir, dep);
				const stat = await fs.stat(pathname, { bigint: true });

				const prev = dependencies[dep];
				const next = '' + stat.mtimeMs;

				if (prev !== next) {
					return;
				}

				arr.push(pathname);
			}

			return { ...metadata, dependencies: arr };
		}
		catch {}
	}

	async #write (filename, key, loader) {
		const { dependencies = [], ...data } = await loader();

		const map = {};
		dependencies.unshift(filename);

		for (const dep of dependencies) {
			const rel = path.relative(this.#baseDir, dep);
			const stat = await fs.stat(dep, { bigint: true });

			map[rel] = '' + stat.mtimeMs;
		}

		const cachePath = this.#getCachePath(filename, key);
		const metadata = { ...data, dependencies: map };

		writer(cachePath, JSON.stringify(metadata));
		return metadata;
	}

	#getCachePath (filename, key = []) {
		const rel = filename = path.relative(this.#baseDir, filename);

		const hashKey = hash(JSON.stringify([rel, ...key]), VERSION).toString(16);
		const cachePath = path.join(this.#cacheDir, hashKey.slice(0, 2), hashKey.slice(2));

		return cachePath;
	}
}

// Basic atomic file writer
function fileWriter () {
	const updates = new Map();
	const tempDir = os.tmpdir();

	async function apply (filename, content) {
		const update = { content: undefined };
		updates.set(filename, update);

		if (content === null) {
			await fs.unlink(filename);
		}
		else {
			const tempPath = path.join(tempDir, 'file' + Math.random().toString(16).slice(2));

			await fs.mkdir(path.dirname(filename), { recursive: true });

			await fs.writeFile(tempPath, content);
			await fs.rename(tempPath, filename);
		}

		updates.delete(filename);

		if (update.content !== undefined) {
			apply(filename, update.content);
		}
	}

	return (filename, content) => {
		const update = updates.get(filename);

		if (update) {
			update.content = content;
		}
		else {
			apply(target, content);
		}
	};
}