import { MenuItem } from "./MenuItem";
import { Form } from "./form/Form";

export class FormItem<T> extends MenuItem<T> {

	protected closeOnClick = false;
	protected invokeOnClick = false;

	private formInstance?: Form;

	protected override buildControl(): HTMLElement {
		if (!this.config.form) {
			throw new Error('Could not build form menu item');
		}

		this.formInstance = new this.config.form();
		this.formInstance.onChange.subscribe((value) => {
			this.onChange.emit(value);
			this.invoke();
		});

		return this.formInstance.build(this.config.value);
	}

	public override dispose(): void {
		this.formInstance?.dispose();
		delete this.formInstance;
	}
}
