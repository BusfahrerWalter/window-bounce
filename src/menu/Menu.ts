import { Vector } from "matter-js";
import { MenuItem } from "./MenuItem";
import { CheckboxItem } from "./CheckboxItem";
import { FormItem } from "./FormItem";
import { Separator } from "./Separator";
import { MenuConfig } from "./MenuItem";
import { Util } from "../util/Util";

export class Menu {

	private static readonly referenceMap = new WeakMap<HTMLElement, Menu>();

	public parent: Menu|null;
	public dom?: HTMLElement;
	private items: MenuItem[];
	private subMenus: Menu[];
	protected prefersLeft: boolean = false;

	constructor(parent: Menu|null, items: MenuConfig) {
		this.parent = parent;
		this.subMenus = [];
		this.items = this.processItems(items);

		if (parent) {
			parent.subMenus.push(this);
		}
	}

	private processItems(items: MenuConfig): MenuItem[] {
		return items.map(item => {
			if (item === '-') {
				return new Separator(this);
			}
			if (item instanceof MenuItem) {
				return item;
			}
			if (Object.hasOwn(item, 'form')) {
				return new FormItem(this, item);
			}
			if (Object.hasOwn(item, 'checked')) {
				return new CheckboxItem(this, item);
			}

			return new MenuItem(this, item);
		});
	}

	public build(): HTMLElement {
		const menu = document.createElement('div');
		menu.classList.add('context-menu');
		menu.popover = 'auto';

		for (const item of this.items) {
			menu.append(item.build());
		}

		Menu.referenceMap.set(menu, this);
		return menu;
	}

	public show(position: Vector): HTMLElement {
		if (this.dom) {
			return this.dom;
		}

		const dom = this.build();
		if (this.parent?.dom) {
			this.parent.dom.append(dom);
		} else {
			document.body.append(dom);
		}

		if (this.parent) {
			this.prefersLeft = this.parent.prefersLeft;
		}

		dom.style.left = `${position.x}px`;
		dom.style.top = `${position.y}px`;

		dom.showPopover();

		// clamp to viewport
		let rect = dom.getBoundingClientRect();
		if (this.prefersLeft || rect.right > window.innerWidth) {
			if (this.parent?.dom) {
				const parentRect = this.parent.dom.getBoundingClientRect();
				dom.style.left = `${Util.clamp(parentRect.left - rect.width, 0, window.innerWidth - rect.width)}px`;
			} else {
				dom.style.left = `${Math.max(window.innerWidth - rect.width, 0)}px`;
			}
			this.prefersLeft = true;
		} else {
			this.prefersLeft = false;
		}

		if (rect.bottom > window.innerHeight) {
			dom.style.top = `${Math.max(window.innerHeight - rect.height, 0)}px`;
		}

		// @ts-ignore I hate ts ...
		dom.addEventListener('toggle', (evt: ToggleEvent) => {
			if (evt.newState === 'closed') {
				this.close(false);
			}
		});

		dom.addEventListener('focusout', (_evt: FocusEvent) => {
			if (!document.hasFocus()) {
				this.close(true);
			}
		});

		const button = dom.querySelector<HTMLButtonElement>('.menu-item');
		if (button) {
			button.focus();
		}

		return (this.dom = dom);
	}

	public close(recursive: boolean = true) {
		if (!this.dom) {
			return;
		}

		this.dom.remove();
		this.dom.hidePopover();
		delete this.dom;

		if (this.parent) {
			const index = this.parent.subMenus.indexOf(this);
			if (index !== -1) {
				this.parent.subMenus.splice(index, 1);
			}
		}

		for (const item of this.items) {
			item.dispose();
		}

		if (this.parent && recursive) {
			this.parent.close(recursive);
		}
	}

	public closeSub() {
		for (const menu of this.subMenus) {
			menu.close(false);
		}
	}

	public contains(menu: Menu|MenuItem|null): boolean {
		if (!menu) {
			return false;
		}

		do {
			if (menu === this) {
				return true;
			}
		} while ((menu = menu.parent));

		return false;
	}
}