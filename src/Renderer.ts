import { Body, Events, Vector } from 'matter-js';
import { Application } from './Application';
import { MessageType } from './Messenger';
import Color from 'color';
import { EventEmitter } from './util/EventEmitter';

type RendererFunction = (body: Body, offset: Vector, ctx: CanvasRenderingContext2D) => void;

export class Renderer {

	public onInitialized: EventEmitter = new EventEmitter();

	private readonly app: Application;

	public background!: [string, string];
	public canvas!: HTMLCanvasElement;
	public ctx!: CanvasRenderingContext2D|null;
	private rendererMap: Map<string, RendererFunction>;

	constructor(app: Application) {
		this.app = app;
		this.rendererMap = new Map();
		this.init();
	}

	private init() {
		const background = Color({
			r: Math.floor(Math.random() * 255),
			g: Math.floor(Math.random() * 255),
			b: Math.floor(Math.random() * 255)
		});

		this.background = [background.hex(), background.darken(.7).hex()];
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.canvas.style.background = `linear-gradient(to bottom, ${this.background[0]}, ${this.background[1]})`;

		this.updateSize();
		this.app.onResize.subscribe(this.updateSize.bind(this));

		this.app.engine.onUpdate.subscribe(this.onEngineUpdate.bind(this));
		this.app.messenger.on(MessageType.ENGINE_UPDATE, this.onEngineUpdate.bind(this));

		document.body.append(this.canvas);

		// register default renderers
		this.registerRenderer('circle', this.renderCircle.bind(this));
		this.registerRenderer('polygon', this.renderPolygon.bind(this));

		if (this.app.settings.enableDebug) {
			this.registerRenderer('border', this.renderPolygon.bind(this));
		}
	}

	private onEngineUpdate(bodies: Body[]) {
		if (!this.ctx) {
			return;
		}

		const offset = this.app.window.position;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.beginPath();

		for (const body of bodies) {
			if (!this.app.window.contains(body.bounds)) {
				continue;
			}

			const renderFn = this.rendererMap.get(body.label);
			if (!renderFn) {
				continue;
			}

			renderFn(body, offset, this.ctx);
		}

		this.ctx.fillStyle = '#dcdcaa';
		this.ctx.fill();
	}

	private updateSize() {
		this.canvas.width = window.innerWidth,
		this.canvas.height = window.innerHeight;
	}

	public registerRenderer(type: string, fn: RendererFunction) {
		this.rendererMap.set(type, fn);
	}

	private renderCircle(body: Body, offset: Vector, ctx: CanvasRenderingContext2D) {
		if (!body.circleRadius) {
			return;
		}

		const x = body.position.x - offset.x;
		const y = body.position.y - offset.y;

		ctx.moveTo(x, y);
		ctx.arc(x, y, body.circleRadius, 0, 2 * Math.PI);
	}

	private renderPolygon(body: Body, offset: Vector, ctx: CanvasRenderingContext2D) {
		if (body.parts.length === 0) {
			return;
		}

		for (let i = body.parts.length > 1 ? 1 : 0; i < body.parts.length; i++) {
			const part = body.parts[i];
			const x1 = part.vertices[0].x - offset.x;
			const y1 = part.vertices[0].y - offset.y;

			ctx.moveTo(x1, y1);
			for (let j = 1; j < part.vertices.length; j++) {
				ctx.lineTo(part.vertices[j].x - offset.x, part.vertices[j].y - offset.y);
			}

			ctx.lineTo(x1, y1);
		}
	}
}