import * as path from 'path';
import relative from 'require-relative';
import { CompileResult } from '../interfaces';
import { RollupResult } from './Result';
import { validate_config } from '../validate_config';
import { Bundler } from '../../../bundlers'
import CheapWatch from 'cheap-watch'

export class RollupCompiler {
	_: Promise<any>;
	_oninvalid: (filename: string) => void;
	_start: number;
	apiMethod: string;
	input: string;
	warnings: any[];
	errors: any[];
	chunks: any[];
	css_files: Array<{ id: string, code: string }>;
	compiler: any;
	cwd: string;
	dev: boolean;
	use_nollup: boolean;

	constructor(config_path: string, bundle_name: string, options: any) {
		this.input = null;
		this.warnings = [];
		this.errors = [];
		this.chunks = [];
		this.css_files = [];
		this.compiler = null;
		this.cwd = path.dirname(config_path);
		this.dev = options.dev;
		this.use_nollup = options.nollup;

		this._ = this.initialize(config_path, bundle_name);
	}

	async initialize (config_path: string, bundle_name: string) {
		const { config, compiler } = await this.load_config(config_path);
		const bundle_config = config[bundle_name];

	  validate_config(config, Bundler.Rollup);

		this.normalize_rollup_config(bundle_config)

		this.compiler = compiler;
		return this.get_config(bundle_config);
	}

	get is_nollup () {
		return this.dev && this.use_nollup
	}

	async load_config(config_path: string) {
		const compiler = relative(this.is_nollup ? 'nollup' : 'rollup', this.cwd);
		const compile_function = this.is_nollup ? compiler : compiler.rollup;

		const bundle = await compile_function({
			input: config_path,
			inlineDynamicImports: true,
			external: (id: string) => {
				return (id[0] !== '.' && !path.isAbsolute(id)) || id.slice(-5, id.length) === '.json';
			}
		});

		const resp = await bundle.generate({ format: 'cjs' });
		const { code } = resp.output ? resp.output[0] : resp;

		// temporarily override require
		const defaultLoader = require.extensions['.js'];
		require.extensions['.js'] = (module: any, filename: string) => {
			if (filename === config_path) {
				module._compile(code, filename);
			} else {
				defaultLoader(module, filename);
			}
		};

		const config: any = require(config_path);
		delete require.cache[config_path];

		return { config, compiler };
	}

	normalize_rollup_config(config: any) {
		if (typeof config.input === 'string') {
			config.input = path.normalize(config.input);
		} else {
			for (const name in config.input) {
				config.input[name] = path.normalize(config.input[name]);
			}
		}
	}

	async get_config(mod: any) {
		// TODO this is hacky, and doesn't need to apply to all three compilers
		(mod.plugins || (mod.plugins = [])).push({
			name: 'sapper-internal',
			options: (opts: any) => {
				this.input = opts.input;
			},
			renderChunk: (code: string, chunk: any) => {
				this.chunks.push(chunk);
			},
			transform: (code: string, id: string) => {
				if (/\.css$/.test(id)) {
					this.css_files.push({ id, code });
					return ``;
				}
			}
		});

		const onwarn = mod.onwarn || ((warning: any, handler: (warning: any) => void) => {
			handler(warning);
		});

		mod.onwarn = (warning: any) => {
			onwarn(warning, (warning: any) => {
				this.warnings.push(warning);
			});
		};

		return mod;
	}

	oninvalid(cb: (filename: string) => void) {
		this._oninvalid = cb;
	}

	async compile(): Promise<CompileResult> {
		const config = await this._;
		const sourcemap = config.output.sourcemap;
		const compile_function = this.is_nollup ? this.compiler : this.compiler.rollup;

		const start = Date.now();

		try {
			const bundle = await compile_function(config);
			await bundle.write(config.output);

			return new RollupResult(Date.now() - start, this, sourcemap);
		} catch (err) {
			if (err.filename) {
				// TODO this is a bit messy. Also, can
				// Rollup emit other kinds of error?
				err.message = [
					`Failed to build — error in ${err.filename}: ${err.message}`,
					err.frame
				].filter(Boolean).join('\n');
			}

			throw err;
		}
	}

	async watch(cb: (err?: Error, stats?: any) => void) {
		const config = await this._;
		const sourcemap = config.output.sourcemap;

		if (this.is_nollup) {
			console.info("Do some watching, somehow");

			return;
		}

		const watcher = this.compiler.watch(config);

		watcher.on('change', (id: string) => {
			this.chunks = [];
			this.warnings = [];
			this.errors = [];
			this._oninvalid(id);
		});

		watcher.on('event', (event: any) => {
			switch (event.code) {
				case 'FATAL':
					// TODO kill the process?
					if (event.error.filename) {
						// TODO this is a bit messy. Also, can
						// Rollup emit other kinds of error?
						event.error.message = [
							`Failed to build — error in ${event.error.filename}: ${event.error.message}`,
							event.error.frame
						].filter(Boolean).join('\n');
					}

					cb(event.error);
					break;

				case 'ERROR':
					this.errors.push(event.error);
					cb(null, new RollupResult(Date.now() - this._start, this, sourcemap));
					break;

				case 'START':
				case 'END':
					// TODO is there anything to do with this info?
					break;

				case 'BUNDLE_START':
					this._start = Date.now();
					break;

				case 'BUNDLE_END':
					cb(null, new RollupResult(Date.now() - this._start, this, sourcemap));
					break;

				default:
					console.log(`Unexpected event ${event.code}`);
			}
		});
	}
}
