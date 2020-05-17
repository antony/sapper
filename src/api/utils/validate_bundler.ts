import * as fs from 'fs';
import { Bundler } from '../../bundlers';

export default function validate_bundler(bundler?: Bundler, nollup?: boolean) {
	const supported_bundlers = Object.values(Bundler)

	let selected_bundler = bundler || supported_bundlers.find(b => fs.existsSync(`${b}.config.js`));

	if (!selected_bundler) {
		throw new Error(`Could not find one of ${supported_bundlers.map(b => `${b}.config.js`).join(', ') }`);
	}

	if (nollup && selected_bundler !== Bundler.Rollup) {
		throw new Error(`Nollup can only be used to optimise Rollup builds.`);
	}

	return selected_bundler;
}

