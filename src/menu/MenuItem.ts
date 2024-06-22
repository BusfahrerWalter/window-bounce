import { EventEmitter } from './../util/EventEmitter';
import { Vector } from "matter-js";
import { Menu } from "./Menu";
import { Util } from '../util/Util';
import { Form } from './form/Form';

export type MenuConfig = (MenuItem | MenuItemConfig | '-')[];

interface Binding<T extends {[key: string]: any} = any> {
	target: T;
	field: keyof T
}

export interface MenuItemConfig {
	text?: string;
	fn?: Function;
	icon?: string;
	menu?: MenuConfig;
	checked?: boolean;
	bind?: Binding;
	form?: new () => Form;
	value?: any;
}

export class MenuItem<TVal = any> {

	public readonly onChange: EventEmitter<TVal> = new EventEmitter();
	public readonly onClick: EventEmitter = new EventEmitter();

	public readonly id: string;

	public parent: Menu;
	public dom?: HTMLElement;

	protected config: MenuItemConfig;
	protected invokeOnClick: boolean = true;
	protected closeOnClick: boolean = true;

	public get hasSubMenu(): boolean {
		return !!this.parent?.dom?.querySelector(`[super-id='${this.id}']:popover-open`);
	}

	constructor(parent: Menu, config: MenuItemConfig) {
		this.id = Util.getGUID();
		this.parent = parent;
		this.config = config;

		if (this.config.bind) {
			const binding = this.config.bind;
			this.onChange.subscribe((value: TVal) => {
				binding.target[binding.field] = value;
			});
		}
	}

	public build(): HTMLElement {
		const dom = document.createElement('button');
		dom.id = this.id;
		dom.classList.add('menu-item');
		dom.addEventListener('click', evt => {
			this.onDomClick(evt);
		});

		const icon = document.createElement('div');
		icon.classList.add('menu-icon');

		if (this.config.icon) {
			const innerIcon = document.createElement('i');
			innerIcon.classList.add(...this.config.icon.split(/\s/));
			icon.append(innerIcon);
		}

		const control = this.buildControl();
		control.classList.add('menu-control');

		const spacer = document.createElement('div');
		spacer.classList.add('spacer');

		const arrow = document.createElement('div');
		arrow.classList.add('menu-arrow');

		if (this.config.menu) {
			arrow.insertAdjacentHTML('beforeend', `
				<i class="menu-arrow-svg fas fa-caret-right"></i>
			`);

			let timeoutId: number|null = null;
			dom.addEventListener('mouseenter', evt => {
				timeoutId = setTimeout(() => {
					timeoutId = null;
					this.showSubMenu();
				}, 200);
			});

			dom.addEventListener('mouseleave', evt => {
				if (timeoutId !== null) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
			})
		}

		dom.append(icon, control, spacer, arrow);
		return (this.dom = dom);
	}

	protected buildControl(): HTMLElement {
		const control = document.createElement('div');
		control.textContent = this.config.text ?? '';

		return control;
	}

	protected invoke() {
		if (typeof this.config.fn === 'function') {
			if (this.config.fn() === false) {
				return false;
			}
		}

		return true;
	}

	protected onDomClick(evt: MouseEvent) {
		if (!this.dom) {
			return;
		}

		const close = () => {
			if (this.closeOnClick) {
				this.parent.close();
			}
		};

		this.onClick.emit();
		if (this.invokeOnClick && this.config.fn && !this.invoke()) {
			return close();
		}

		if (!this.config.menu) {
			return close();
		}

		this.showSubMenu();
	}

	protected showSubMenu() {
		if (!this.dom || !this.config.menu || this.hasSubMenu) {
			return;
		}

		const menu = new Menu(this.parent, this.config.menu);
		const rect = this.dom.getBoundingClientRect();
		const menuDom = menu.show(Vector.create(rect.right + 5, rect.top - 5));
		menuDom.setAttribute('super-id', this.id);
	}

	public dispose() {}
}
