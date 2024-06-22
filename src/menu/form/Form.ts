import { EventEmitter } from "../../util/EventEmitter";

export abstract class Form<T = any> {

	public readonly onChange: EventEmitter<T> = new EventEmitter();
	protected readonly config: any;

	constructor(config?: any) {
		this.config = config ?? {};
	}

	abstract build(value: T): HTMLElement;
	dispose(): void {}
}