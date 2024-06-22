import { Util } from "../util/Util";
import { MenuItem } from "./MenuItem";

export class CheckboxItem extends MenuItem<boolean> {

	protected closeOnClick = false;
	protected invokeOnClick = false;

	protected override buildControl(): HTMLElement {
		const dom = document.createElement('div');
		dom.classList.add('menu-checkbox');
		dom.tabIndex = 1;

		const id = `checkbox-${Util.getGUID()}`;
		const checkbox = document.createElement('input');
		checkbox.id = id;
		checkbox.type = 'checkbox';
		checkbox.checked = this.config.checked ?? false;

		const label = document.createElement('label');
		label.setAttribute('for', id);
		label.textContent = this.config.text ?? '';

		dom.addEventListener('click', evt => {
			if (evt.target === this.dom) {
				checkbox.click();
			}
		});

		dom.addEventListener('change', evt => {
			this.onChange.emit(checkbox.checked);
			this.invoke();
		});

		dom.append(checkbox, label);
		return dom;
	}
}
