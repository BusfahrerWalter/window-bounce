import { Application } from "./Application";
import { EventEmitter } from "./util/EventEmitter";
import { Util } from "./util/Util";

type MessageEventHandler<T = any> = (data: T, requestId?: string) => void;

export interface MessageEventData<T = any> {
	type: MessageType;
	target: MessageTarget
	data: T;
	id?: string;
}

export enum MessageTarget {
	ALL = 'all',
	CLIENT = 'client',
	HOST = 'host'
}

export enum MessageType {
	RESPONSE = 'response',
	WINDOW_OPEN = 'window-open',
	WINDOW_CLOSE = 'window-close',
	WINDOW_UPDATE = 'window-update',
	WINDOW_INFO = 'window-info',
	ENGINE_UPDATE = 'engine-update',
	ENGINE_ADD = 'engine-add',
	ENGINE_REMOVE = 'engine-remove',
	ENGINE_CONFIGURE = 'engine-configure',
	DRAG_START = 'drag-start',
	DRAG_END = 'drag-end',
	DRAG_MOVE = 'drag-move'
}

export class Messenger {

	public readonly onMessage: EventEmitter<MessageEventData> = new EventEmitter();

	private readonly app: Application;
	private readonly channel: BroadcastChannel
	private readonly eventMap: Map<string, MessageEventHandler[]>;
	private readonly requestMap: Map<string, Function>;

	constructor(app: Application) {
		this.app = app;
		this.channel = new BroadcastChannel('nice-msg-channel');
		this.eventMap = new Map();
		this.requestMap = new Map();
		this.init();
	}

	private init() {
		this.channel.addEventListener('message', this.onBroadcastMessage.bind(this));
	}

	private onBroadcastMessage(evt: MessageEvent<MessageEventData>) {
		const target = evt.data.target;
		if (target !== MessageTarget.ALL) {
			const isHost = this.app.isHost;
			if ((target === MessageTarget.HOST && !isHost) || (target === MessageTarget.CLIENT && isHost)) {
				return;
			}
		}

		this.onMessage.emit(evt.data);

		if (evt.data.type === MessageType.RESPONSE) {
			const id = evt.data.id ?? '';
			const resolveFn = this.requestMap.get(id);
			if (resolveFn) {
				this.requestMap.delete(id);
				resolveFn(evt.data.data);
				return;
			}
		}

		const mapData = this.eventMap.get(evt.data.type);
		if (!mapData) {
			return;
		}

		for (const fn of mapData) {
			fn(evt.data.data, evt.data.id);
		}
	}

	public sendMessage<T = any>(type: MessageType, data: T, target?: MessageTarget, id?: string) {
		target = target ?? MessageTarget.ALL;
		this.channel.postMessage({ type, data, target, id });
	}

	public async sendRequest<T = any>(type: MessageType, data: T, target?: MessageTarget) {
		const guid = Util.getGUID();
		const promise = new Promise((resolve, _reject) => {
			this.requestMap.set(guid, resolve);
		});

		this.sendMessage(type, data, target, guid);
		return await promise;
	}

	public sendResponse<T = any>(data: T, target?: MessageTarget, id?: string) {
		this.sendMessage(MessageType.RESPONSE, data, target, id);
	}

	public on<T = any>(type: MessageType, fn: MessageEventHandler<T>) {
		const arr = this.eventMap.get(type) ?? [];
		arr.push(fn);
		this.eventMap.set(type, arr);
	}
}