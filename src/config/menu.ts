import { Bodies, Body } from 'matter-js';
import { Application } from '@/Application';
import { MenuConfig, MenuItemConfig } from "@/menu/MenuItem";
import { Util } from '../util/Util';
import { Slider2DForm } from '../menu/form/Slider2DForm';

const settingsFormMap: {[key: string]: (app: Application, key: string, value: any) => MenuItemConfig|null} = {
	gravity: (app: Application, key: string, value: any) => {
		return {
			text: Util.insertSpaces(key),
			menu: [{
				text: 'Direction',
				value: app.settings.gravity,
				form: Slider2DForm,
				bind: {
					target: app.settings,
					field: key
				},
				fn: () => {
					app.storage.set('settings', app.settings);
				}
			}, {
				text: 'Scale',
				value: app.settings.gravityScale,
				bind: {
					target: app.settings,
					field: 'gravityScale'
				},
				fn: () => {
					app.storage.set('settings', app.settings);
				}
			}]
		};
	},
	gravityScale: () => null
}

export default function(app: Application): MenuConfig {
	const spawnButtons = (cfg?: any): MenuConfig => {
		cfg = cfg ?? {};
		return [{
			text: 'Circle',
			fn: () => {
				const spawn = (x: number, y: number) => {
					const body = Bodies.circle(x, y, 80, Object.assign(cfg, {
						label: 'circle'
					}));
					app.engine.add(body);
				};

				spawn(app.menu.position.x, app.menu.position.y);
				app.previousSpawnFn = spawn;
			}
		}, {
			text: 'Rectangle',
			fn: () => {
				const spawn = (x: number, y: number) => {
					const body = Bodies.rectangle(x, y, 80, 80, Object.assign(cfg, {
						label: 'polygon'
					}));
					app.engine.add(body);
				};

				spawn(app.menu.position.x, app.menu.position.y);
				app.previousSpawnFn = spawn;
			}
		}];
	};

	const settingsButtons = (): MenuConfig => {
		const data: MenuConfig = [];
		for (const key in app.settings) {
			const value = (app.settings as any)[key];
			if (settingsFormMap[key]) {
				const control = settingsFormMap[key](app, key, value);
				if (control) {
					data.push(control);
				}
				continue;
			}

			const cfg: MenuItemConfig = {
				text: Util.insertSpaces(key),
				bind: {
					target: app.settings,
					field: key
				},
				fn: () => {
					app.storage.set('settings', app.settings);
				}
			};

			if (typeof value === 'boolean') {
				cfg.checked = value;
			}

			data.push(cfg);
		}

		return data;
	}

	const items: MenuConfig = [{
		text: 'Spawn dynamic',
		icon: 'fa-solid fa-feather-pointed',
		menu: spawnButtons()
	}, {
		text: 'Spawn static',
		icon: 'fa-solid fa-link',
		menu: spawnButtons({
			isStatic: true
		})
	},
	'-',
	{
		text: 'Settings',
		icon: 'fa-solid fa-gear',
		menu: settingsButtons()
	},
	{
		text: 'Clear cache',
		fn: () => {
			app.storage.clear();
		}
	},
	{
		text: `Clear bodies`,
		fn: () => {
			app.engine.clearBodies();
		}
	},
	'-',
	{
		text: 'New window',
		fn: () => {
			const url = new URL(window.location.href);
			url.searchParams.set('parent', app.id);
			window.open(url, '_blank');
		}
	}];

	const url = new URL(window.location.href);
	if (url.searchParams.has('parent')) {
		items.push({
			text: 'Close',
			fn: () => {
				window.close();
			}
		});
	}

	return items;
};