import * as fs from 'fs';
import { Bundler } from '../../bundlers';

export default function validate_bundler(bundler?: Bundler) {
	const supported_bundlers = Object.values(Bundler)
	let selected_bundler = bundler || supported_bundlers.find(b => fs.existsSync(`${b}.config.js`));

	if (!selected_bundler) {
		throw new Error(`Could not find one of ${supported_bundlers.map(b => `${b}.config.js`).join(', ') }`);
	}

	return selected_bundler;
}

function deprecate_dir(bundler: Bundler) {
	try {
		const stats = fs.statSync(bundler);
		if (!stats.isDirectory()) return;
	} catch (err) {
		// do nothing
		return;
	}

	// TODO link to docs, once those docs exist
	throw new Error(`As of Sapper 0.21, build configuration should be placed in a single ${bundler}.config.js file`);
}
