import { EventEmitter } from "../../util/EventEmitter";

export abstract class Form<T = any> {

	public readonly onChange: EventEmitter<T> = new EventEmitter();

	abstract build(value: T): HTMLElement;
	dispose(): void {}
}