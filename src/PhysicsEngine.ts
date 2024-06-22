import Matter, { Bodies, Body, Bounds, Common, Composite, Constraint, Engine, Events, Query, Render, Vector, Vertices, World } from "matter-js";
// @ts-ignore No types ...
import * as decomp from 'poly-decomp';
import { Application } from "./Application";
import { EventEmitter } from "./util/EventEmitter";
import { MessageTarget, MessageType } from "./Messenger";
import { Util } from "./util/Util";

export class PhysicsEngine {

	public readonly onUpdate: EventEmitter<Body[]> = new EventEmitter();
	public readonly onCollisionStart: EventEmitter<Matter.IEventCollision<Engine>> = new EventEmitter();

	private readonly app: Application;
	private readonly engine: Engine;

	public bodies: Body[] = [];
	private isRunning: boolean = false;
	private spring?: Constraint|boolean;

	constructor(app: Application) {
		this.app = app;
		this.engine = Engine.create();
		this.init();
	}

	private init() {
		// @ts-ignore
		window.decomp = decomp.default;
		window.Matter = Matter;

		Common.setDecomp(decomp.default);

		window.addEventListener('mousedown', evt => {
			if (evt.button !== 0) {
				return;
			}

			const position = Vector.create(evt.screenX, evt.screenY);
			if (!this.app.isHost) {
				this.app.messenger.sendMessage(MessageType.DRAG_START, position, MessageTarget.HOST);
				this.spring = true;
				return;
			}

			this.onMouseDown(position);
		});
		window.addEventListener('mouseup', evt => {
			if (!this.spring) {
				return;
			}

			const position = Vector.create(evt.screenX, evt.screenY);
			if (!this.app.isHost) {
				this.app.messenger.sendMessage(MessageType.DRAG_END, position, MessageTarget.HOST);
				this.spring = undefined;
				return;
			}

			this.onMouseUp(position);
		});
		window.addEventListener('mousemove', evt => {
			if (!this.spring) {
				return;
			}

			const position = Vector.create(evt.screenX, evt.screenY);
			if (!this.app.isHost) {
				this.app.messenger.sendMessage(MessageType.DRAG_MOVE, position, MessageTarget.HOST);
				return;
			}

			this.onMouseMove(position);
		});

		this.app.messenger.on(MessageType.ENGINE_ADD, this.onEngineAdd.bind(this));
		this.app.messenger.on(MessageType.ENGINE_REMOVE, this.onEngineRemove.bind(this));
		this.app.messenger.on(MessageType.ENGINE_UPDATE, this.onEngineUpdate.bind(this));
		this.app.messenger.on(MessageType.DRAG_START, this.onMouseDown.bind(this));
		this.app.messenger.on(MessageType.DRAG_END, this.onMouseUp.bind(this));
		this.app.messenger.on(MessageType.DRAG_MOVE, this.onMouseMove.bind(this));

		// add ground
		// const ground = Bodies.rectangle(0, screen.availHeight + 50, 99999, 100, {
		// 	isStatic: true
		// });

		// Composite.add(this.engine.world, ground);

		// if (this.app.settings.enableDebug) {
		// 	Render.run(Render.create({
		// 		element: document.body,
		// 		engine: this.engine,
		// 		options: {
		// 			width: window.innerWidth,
		// 			height: window.innerHeight
		// 		}
		// 	}));
		// }
	}

	private onMouseDown(position: Vector) {
		if (!this.isRunning) {
			return;
		}

		const mousePos = Vector.create(position.x, position.y);
		const body = this.getBodyAtPosition(mousePos);
		if (!body || body.label === 'border') {
			return;
		}

		this.spring = Constraint.create({
			pointA: mousePos,
			pointB: Vector.sub(mousePos, body.position),
			bodyB: body,
			stiffness: .9,
			damping: 0,
			render: {
				visible: false
			}
		});

		World.add(this.engine.world, this.spring);
	}

	private onMouseUp(position: Vector) {
		if (typeof this.spring !== 'object' || !this.isRunning) {
			return;
		}

		World.remove(this.engine.world, this.spring);
		this.spring = undefined;
	}

	private onMouseMove(position: Vector) {
		if (typeof this.spring !== 'object' || !this.isRunning) {
			return;
		}

		if (this.spring.bodyB?.isStatic) {
			Body.set(this.spring.bodyB, {
				position: position
			});
		} else {
			this.spring.pointA = position;
		}
	}

	private onEngineUpdate(bodies: Body[]) {
		if (!this.isRunning) {
			this.bodies = bodies;
		}
	}

	private onEngineAdd(bodies: Body[]) {
		this.add(...bodies);
	}

	private onEngineRemove(bodies: Body[]) {
		this.remove(...bodies);
	}

	private loop() {
		Engine.update(this.engine);

		this.app.messenger.sendMessage(MessageType.ENGINE_UPDATE, this.bodies, MessageTarget.CLIENT);
		this.onUpdate.emit(this.bodies);

		requestAnimationFrame(this.loop.bind(this));
	}

	public run() {
		if (this.isRunning) {
			return;
		}

		if (this.bodies) {
			Composite.add(this.engine.world, this.bodies);
		}

		// const collisionEventHandler = (evt: Matter.IEventCollision<Engine>) => {
		// 	const infos = this.app.getInfosSync();
		// 	const bounds = infos.map(info => Util.inflateBounds(Util.rectToBounds(info.rect), -10));

		// 	for (const pair of evt.pairs) {
		// 		if (pair.bodyA.label !== 'border' && pair.bodyB.label !== 'border') {
		// 			continue;
		// 		}

		// 		console.log(pair.contacts.map(c => c.vertex.body.id).join(', '));

		// 		const contactsOnBody = pair.contacts.filter(contact => {
		// 			return contact.vertex.body.label !== 'border';
		// 		});

		// 		if (contactsOnBody.length === 0) {
		// 			continue;
		// 		}

		// 		// const isInBounds = bounds.some(bound => {
		// 		// 	return pair.contacts.every(contact => Bounds.contains(bound, contact.vertex));
		// 		// });
		// 		// console.log(pair.contacts, pair.activeContacts);

		// 		const isInBounds = contactsOnBody.some(contact => {
		// 			return bounds.some(bound => Bounds.contains(bound, contact.vertex));
		// 		});

		// 		if (isInBounds) {
		// 			pair.isActive = false;
		// 		}
		// 		else {
		// 			console.log(contactsOnBody);
		// 		}

		// 		// Bounds.contains(bound, Vector.sub(contact.vertex, pair.collision.penetration))
		// 		// console.log(isInBounds, pair.collision.penetration);
		// 	}
		// };

		// Events.on(this.engine, 'collisionStart', collisionEventHandler);

		this.isRunning = true;
		this.loop();
	}

	public addCircle(screenPos: Vector) {
		const body = Bodies.circle(screenPos.x, screenPos.y, 80, {
			restitution: 1,
			label: 'circle'
		});

		this.add(body);
	}

	public addRect(screenPos: Vector) {
		const body = Bodies.rectangle(screenPos.x, screenPos.y, 80, 80, {
			restitution: 1,
			label: 'polygon'
		});

		this.add(body);
	}

	public addPolygon(screenPos: Vector, vertices: Vector[]) {
		const body = Bodies.fromVertices(screenPos.x, screenPos.y, [
			Vertices.clockwiseSort(vertices)
		], {
			restitution: 1,
			label: 'polygon'
		});

		this.add(body);
	}

	public add(...bodies: Body[]) {
		if (!this.app.isHost) {
			this.app.messenger.sendMessage(MessageType.ENGINE_ADD, bodies, MessageTarget.HOST);
			return;
		}

		this.bodies.push(...bodies);
		Composite.add(this.engine.world, bodies);
	}

	public remove(...bodies: Body[]) {
		if (!this.app.isHost) {
			this.app.messenger.sendMessage(MessageType.ENGINE_REMOVE, bodies, MessageTarget.HOST);
			return;
		}

		this.bodies = this.bodies.filter(body => {
			return !bodies.includes(body);
		});

		Composite.remove(this.engine.world, bodies);
	}

	public getBodyAtPosition(position: Vector): Body|null {
		const bodies = Query.point(Composite.allBodies(this.engine.world), position);
		return bodies.find(body => body.label !== 'border') ?? null;
	}

	public clearBodies() {
		const toRemove = this.bodies.filter(body => {
			return body.label !== 'border';
		});

		this.remove(...toRemove);
	}
}