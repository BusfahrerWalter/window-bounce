import { Menu } from "./Menu";
import { MenuItem } from "./MenuItem";

export class Separator extends MenuItem {

	constructor(parent: Menu) {
		super(parent, {});
	}

	public override build(): HTMLElement {
		const dom = document.createElement('div');
		dom.classList.add('menu-item', 'separator');

		return dom;
	}
}
