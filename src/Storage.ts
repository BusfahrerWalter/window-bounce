import { EventEmitter } from "./util/EventEmitter";

export interface ChangeEventData {
	key: string;
	newValue: any;
	oldValue: any;
}

export class DataStorage {

	public readonly onChange: EventEmitter<ChangeEventData> = new EventEmitter();

	public get hasStorage(): boolean {
		return !!this.storage;
	}

	private get storage(): Storage {
		return window.localStorage || window.sessionStorage;
	}

	constructor() {
		window.addEventListener('storage', this.onLocalStorageChange.bind(this));
	}

	private onLocalStorageChange(evt: StorageEvent) {
		if (!evt.key) {
			return;
		}

		this.onChange.emit({
			key: evt.key,
			newValue: evt.newValue,
			oldValue: evt.oldValue
		});
	}

	public set(key: string, value: any): void {
		if (!this.hasStorage) {
			return;
		}

		value = typeof value === 'string' ? value : JSON.stringify(value);
		this.storage[key] = value;
	}

	public get(key: string, fallback: any = null): any {
		if (!this.hasStorage) {
			return fallback;
		}

		const value = this.storage[key];
		if (!value) {
			return fallback;
		}

		try {
			return JSON.parse(value);
		} catch(err) {
			return value;
		}
	}

	public delete(key: string): void {
		if (!this.hasStorage) {
			return;
		}

		delete this.storage[key];
	}

	public clear() {
		if (!this.hasStorage) {
			return;
		}

		this.storage.clear();
	}
}