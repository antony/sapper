import { Bundler } from '../../bundlers';

export function validate_config(config: any, bundler: Bundler) {
	if (!config.client || !config.server) {
		throw new Error(`${bundler}.config.js must export a { client, server, serviceworker? } object`);
	}
}