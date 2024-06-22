import { MessageTarget, MessageType, Messenger } from "./Messenger";
import { Renderer } from "./Renderer";
import { DataStorage } from "./Storage";
import { ClientWindow, Rect } from "./Window";
import { EventEmitter } from "./util/EventEmitter";
import { Util } from "./util/Util";
import { PhysicsEngine } from "./PhysicsEngine";
import { ContextMenu } from "./ContextMenu";
import { Bodies, Body, Bounds, Common, Vector, Vertices, World } from "matter-js";

interface WindowInfo {
	background: [string, string];
	isVisible: boolean,
	rect: Rect;
	id: string;
}

export interface ApplicationConfig {
	enableBorder: boolean;
	enableDebug: boolean;
	showMinimap: boolean;
	gravity: Vector;
	gravityScale: number;
}

export class Application {

	public readonly onResize: EventEmitter = new EventEmitter();
	public readonly onMove: EventEmitter = new EventEmitter();

	public readonly id: string;
	public readonly settings: ApplicationConfig;
	public readonly renderer: Renderer;
	public readonly storage: DataStorage;
	public readonly window: ClientWindow;
	public readonly messenger: Messenger;
	public readonly engine: PhysicsEngine;
	public readonly menu: ContextMenu;

	private readonly overlayText: HTMLElement;

	private windowInfoCache: WindowInfo[];
	public previousSpawnFn?: Function;

	public get isHost(): boolean {
		return this.getHost() === this.id;
	}

	constructor() {
		this.id = Util.getGUID();
		this.windowInfoCache = [];

		this.storage = new DataStorage();
		const storedSettings = this.storage.get('settings', {});
		this.settings = Object.assign({
			enableBorder: true,
			enableDebug: false,
			showMinimap: true,
			gravity: Vector.create(0, 1),
			gravityScale: .001
		}, storedSettings);

		this.window = new ClientWindow(this);
		this.messenger = new Messenger(this);
		this.engine = new PhysicsEngine(this);
		this.renderer = new Renderer(this);
		this.menu = new ContextMenu(this);
		this.overlayText = document.getElementById('overlay-text') as HTMLElement;

		this.init();
	}

	public static checkBrowser(): boolean {
		const regex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i
		const isMobile = navigator.userAgent.match(regex);

		if (isMobile) {
			const text = document.getElementById('mobile-text') as HTMLElement;
			text.style.display = 'block';
		}

		return !isMobile;
	}

	private async init() {
		// register events
		window.addEventListener('close', this.onCurrentWindowClose.bind(this), true);
		window.addEventListener('unload', this.onCurrentWindowClose.bind(this), true);
		window.addEventListener('resize', this.onCurrentWindowResize.bind(this), true);
		window.addEventListener('mousedown', this.onCurrentWindowMouseDown.bind(this));

		// mäh...
		let prevX = 0, prevY = 0;
		setInterval(() => {
			if (window.screenX !== prevX || window.screenY !== prevY) {
				prevX = window.screenX
				prevY = window.screenY;
				this.onCurrentWindowMove();
			}
		}, 50);

		this.messenger.on(MessageType.WINDOW_OPEN, this.onWindowOpen.bind(this));
		this.messenger.on(MessageType.WINDOW_CLOSE, this.onWindowClose.bind(this));
		this.messenger.on(MessageType.WINDOW_UPDATE, this.onWindowUpdate.bind(this));
		this.messenger.on(MessageType.WINDOW_INFO, this.onWindowInfo.bind(this));

		this.messenger.sendMessage(MessageType.WINDOW_OPEN, {
			id: this.id,
			rect: this.window.rect
		}, MessageTarget.HOST);

		const currentHost = this.getHost();
		if (!currentHost) {
			this.setHost(this.id);
			this.setupHost();
		}

		this.updateOverlayText();
	}

	private onWindowOpen() {
		if (this.isHost) {
			this.updateHost();
		}
	}

	private onWindowClose(windowId: string) {
		if (this.isHost) {
			this.updateHost();
			return;
		}

		const host = this.getHost();
		if (host) {
			return;
		}

		this.setHost(this.id);
		if (!this.isHost) {
			return;
		}

		this.setupHost();
	}

	private onWindowUpdate(windowId: string) {
		if (this.isHost) {
			this.updateHost();
		}
	}

	private async onWindowInfo(data: string, requestId?: string) {
		if (data !== this.id) {
			return;
		}

		const response = await this.getInfo();
		this.messenger.sendResponse(response, MessageTarget.HOST, requestId);
	}

	private onCurrentWindowClose(evt: Event) {
		const windows = this.window.getWindowIDs();
		const index = windows.indexOf(this.id);
		if (index === -1) {
			return;
		}

		windows.splice(index, 1);
		this.storage.set('windows', windows);
		if (this.isHost) {
			this.setHost(null);
		}

		this.messenger.sendMessage(MessageType.WINDOW_CLOSE, this.id, MessageTarget.ALL);
	}

	private onCurrentWindowResize(evt: Event) {
		this.onResize.emit();
		if (this.isHost) {
			this.onWindowUpdate(this.id);
		} else {
			this.messenger.sendMessage(MessageType.WINDOW_UPDATE, this.id, MessageTarget.HOST);
		}
	}

	private onCurrentWindowMove() {
		this.onMove.emit();
		if (this.isHost) {
			this.onWindowUpdate(this.id);
		} else {
			this.messenger.sendMessage(MessageType.WINDOW_UPDATE, this.id, MessageTarget.HOST);
		}
	}

	private onCurrentWindowMouseDown(evt: MouseEvent) {
		if (evt.button !== 1) {
			return;
		}

		if (typeof this.previousSpawnFn === 'function') {
			this.previousSpawnFn(evt.screenX, evt.screenY);
		} else {
			this.engine.addCircle(Vector.create(evt.screenX, evt.screenY));
		}
	}

	public async getInfo(windowId?: string): Promise<WindowInfo> {
		if (!windowId || windowId === this.id) {
			return {
				background: this.renderer.background,
				isVisible: document.visibilityState === 'visible',
				rect: this.window.rect,
				id: this.id
			};
		}

		return await this.messenger.sendRequest(MessageType.WINDOW_INFO, windowId) as WindowInfo;
	}

	public async getInfos(visibleOnly: boolean = true): Promise<WindowInfo[]> {
		const windows = this.window.getWindowIDs();
		const infos: WindowInfo[] = [];
		for (const windowId of windows) {
			const info = await this.getInfo(windowId);
			infos.push(info);
		}

		this.windowInfoCache = infos;
		return visibleOnly ? infos.filter(info => info.isVisible) : infos;
	}

	public getInfosSync(visibleOnly: boolean = true): WindowInfo[] {
		return visibleOnly ? this.windowInfoCache.filter(info => info.isVisible) : this.windowInfoCache;
	}

	public getHost(): string|null {
		return this.storage.get('host');
	}

	public setHost(id: string|null) {
		if (!id) {
			this.storage.delete('host');
			return;
		}

		this.storage.set('host', id);
	}

	public setupHost() {
		if (!this.isHost) {
			return;
		}

		this.engine.run();
	}

	public updateHost() {
		if (!this.isHost) {
			return;
		}

		this.updateOverlayText();
		this.updateMiniMap();
		this.updateBorders();
	}

	private updateOverlayText() {
		if (!this.isHost) {
			this.overlayText.style.display = 'none';
			return;
		}

		const windows = this.window.getWindowIDs();
		this.overlayText.style.display = windows.length > 1 ? 'none' : 'block';
	}

	public async updateMiniMap(scale: number = .1, padding: number = 5) {
		if (!this.isHost) {
			return;
		}

		const existing = document.querySelector('.mini-map') as HTMLCanvasElement;
		if (!this.settings.showMinimap) {
			existing?.remove();
			return;
		}

		const canvas = existing ?? document.createElement('canvas');
		if (!existing) {
			canvas.classList.add('mini-map');
			document.body.append(canvas);
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}

		// get infos
		const infos = await this.getInfos();

		// get size
		let left = Infinity, right = 0;
		let top = Infinity, bottom = 0;
		for (const info of infos) {
			left = Math.min(left, info.rect.x);
			right = Math.max(right, info.rect.x + info.rect.width);
			top = Math.min(top, info.rect.y);
			bottom = Math.max(bottom, info.rect.y + info.rect.height);
		}

		const width = (right - left) * scale + padding * 2;
		const height = (bottom - top) * scale + padding * 2;
		canvas.width = width;
		canvas.height = height;

		// draw
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 5;
		ctx.font = '16px sans-serif';
		ctx.fillStyle = '#ffffff99';

		ctx.beginPath();
		ctx.strokeRect(0, 0, width, height);

		ctx.fillRect(0, 0, width, height);
		for (const info of infos) {
			const x = (info.rect.x - left) * scale + padding;
			const y = (info.rect.y - top) * scale + padding;
			const w = info.rect.width * scale;
			const h = info.rect.height * scale;

			const gradient = ctx.createLinearGradient(0, 0, 0, height);
			gradient.addColorStop(0, info.background[0]);
			gradient.addColorStop(1, info.background[1]);

			ctx.fillStyle = gradient;
			ctx.fillRect(x, y, w, h);

			const text = `${info.rect.width} × ${info.rect.height}`;
			const metrics = ctx.measureText(text);

			ctx.fillStyle = '#00000099';
			ctx.fillRect(x + 5, y + 6, metrics.width + 2, metrics.fontBoundingBoxDescent + metrics.fontBoundingBoxAscent);
			ctx.fillStyle = 'white';
			ctx.fillText(text, x + 5, y + 20);
		}

		ctx.fill();
	}

	public async updateBorders(thickness: number = 50) {
		const removeBorder = () => {
			const oldBorder = this.engine.bodies.filter(body => body.label === 'border');
			if (oldBorder.length) {
				this.engine.remove(...oldBorder);
			}
		};

		if (!this.settings.enableBorder) {
			removeBorder();
			return;
		}

		if (!this.isHost) {
			return;
		}

		const borderGroups = await this.window.getBorder(thickness);

		// set the `setPosition` function to an empty function because it kinda messes up the positioning of the border shape
		// not pretty but it gets the job done ...
		const setPositionFn = Body.setPosition;
		Body.setPosition = () => {};

		const borderBodies = borderGroups.map(group => {
			const center = Vertices.centre(group);
			return Bodies.fromVertices(center.x, center.y, [group], {
				isStatic: true,
				label: 'border' // will not be rendered per default
			}, undefined, undefined, undefined, -1);
		}).filter(body => body);

		// reset `setPosition` function
		Body.setPosition = setPositionFn;

		// remove older border and add new border to engine
		removeBorder();
		this.engine.add(...borderBodies);
	}
}