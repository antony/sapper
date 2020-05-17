import * as path from 'path';
import { NollupCompiler } from '../compilers/nollup/Compiler';
import { RollupCompiler } from '../compilers/rollup/Compiler';
import { WebpackCompiler } from '../compilers/webpack/Compiler';
import { set_dev, set_src, set_dest } from '../../config/env';
import { Bundler } from '../../bundlers';

export type Compiler = RollupCompiler | WebpackCompiler;

export type Compilers = {
	client: Compiler;
	server: Compiler;
	serviceworker?: Compiler;
}

function get_compilers (config_path: string, compiler: any, dev: boolean) {
	const requested_bundles = [ 'client', 'server', 'serviceworker' ]

	return requested_bundles.reduce((compilers, bundle_name) => {
		const loaded = new compiler(config_path, bundle_name, dev)
		return { ...compilers, ...loaded ? { [bundle_name]: loaded } : {}}
	}, {})
}

export default async function create_compilers(
	bundler: Bundler,
	nollup: boolean,
	cwd: string,
	src: string,
	dest: string,
	dev: boolean
): Promise<Compilers> {
	set_dev(dev);
	set_src(src);
	set_dest(dest);

	const compilers = {
		[Bundler.Rollup]: {
			config_path: path.resolve(cwd, 'rollup.config.js'),
			compiler: RollupCompiler,
			options: {
				dev,
				nollup
			}
		},
		[Bundler.Webpack]: {
			config_path: path.resolve(cwd, 'webpack.config.js'),
			compiler: WebpackCompiler,
			options: {}
		}
	}

	const { config_path, compiler, options } = compilers[bundler]
	return get_compilers(config_path, compiler, options);
}

