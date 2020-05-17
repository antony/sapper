import relative from 'require-relative';
import { CompileResult } from '../interfaces';
import { WebpackResult } from './Result';

export class WebpackCompiler {
	_: any;

	constructor(config_path: string, bundle_name: string) {
		const webpack = relative('webpack', process.cwd());

		this._ = webpack(require(config_path)[bundle_name]);
	}

	oninvalid(cb: (filename: string) => void) {
		this._.hooks.invalid.tap('sapper', cb);
	}

	compile(): Promise<CompileResult> {
		return new Promise((fulfil, reject) => {
			this._.run((err: Error, stats: any) => {
				if (err) {
					reject(err);
					process.exit(1);
				}

				const result = new WebpackResult(stats);

				if (result.errors.length) {
					console.error(stats.toString({ colors: true }));
					reject(new Error(`Encountered errors while building app`));
				}

				else {
					fulfil(result);
				}
			});
		});
	}

	watch(cb: (err?: Error, stats?: any) => void) {
		this._.watch({}, (err?: Error, stats?: any) => {
			cb(err, stats && new WebpackResult(stats));
		});
	}
}