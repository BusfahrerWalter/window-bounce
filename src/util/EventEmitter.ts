type EventListener<T> = (data: T) => void;

export class EventEmitter<T = void> {

	private listeners: EventListener<T>[];

	constructor() {
		this.listeners = [];
	}

	subscribe(fn: EventListener<T>) {
		this.listeners.push(fn);
	}

	unsubscribe(fn: EventListener<T>): void {
		const index = this.listeners.indexOf(fn);
		if (index === -1) {
			return;
		}

		this.listeners.splice(index, 1);
	}

	emit(data: T): void {
		for (const listener of this.listeners) {
			listener(data);
		}
	}
}