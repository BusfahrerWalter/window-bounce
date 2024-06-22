import { Vector } from 'matter-js';
import { Form } from './Form';
import { Util } from '../../util/Util';

export class Slider2DForm extends Form<Vector> {

	private isMouseDown: boolean = false;
	private dom?: HTMLElement;
	private rect?: DOMRect;
	private dot?: HTMLElement;
	private display?: HTMLElement

	constructor() {
		super();
		this.onWindowMouseMove = this.onWindowMouseMove.bind(this);
		this.onWindowMouseUp = this.onWindowMouseUp.bind(this);
	}

	public build(value: Vector): HTMLElement {
		const dom = document.createElement('div');
		dom.classList.add('slider-2d');

		const dot = document.createElement('div');
		dot.classList.add('slider-2d-dot');

		const display = document.createElement('div');
		display.classList.add('slider-2d-display');

		dom.addEventListener('mousedown', evt => {
			this.isMouseDown = true;
			this.onWindowMouseMove(evt);
			window.addEventListener('mousemove', this.onWindowMouseMove);
		});

		window.addEventListener('mouseup', this.onWindowMouseUp);

		this.dom = dom
		this.dot = dot;
		this.display = display;

		this.setDotPos(value);
		dom.append(dot, display);
		return dom;
	}

	private onWindowMouseMove(evt: MouseEvent) {
		if (!this.isMouseDown || !this.dom) {
			return;
		}

		const rect = this.getRect();
		const mousePos = Vector.create(evt.pageX, evt.pageY);
		const formPos = Vector.create(rect.x, rect.y);
		const relativePos = Vector.sub(mousePos, formPos);

		this.setDotPos(relativePos);
	}

	private onWindowMouseUp(evt: MouseEvent) {
		this.isMouseDown = false;
		window.addEventListener('mousemove', this.onWindowMouseMove);
	}

	setDotPos(pos: Vector): void {
		if (!this.dot || !this.dom || !this.display) {
			return;
		}

		const rect = this.getRect();
		const relativePos = Vector.create(pos.x / rect.width, pos.y / rect.height);
		const clampedPos = Vector.create(Util.clamp01(relativePos.x), Util.clamp01(relativePos.y));

		this.dot.style.setProperty('top', `${clampedPos.y * 100}%`);
		this.dot.style.setProperty('left', `${clampedPos.x * 100}%`);
		this.display.textContent = `${clampedPos.x.toFixed(2)} x ${clampedPos.y.toFixed(2)}`;

		this.onChange.emit(clampedPos);
	}

	getRect(): DOMRect {
		if (this.rect) {
			return this.rect;
		}

		const rect = this.dom?.getBoundingClientRect() as DOMRect;
		if (rect?.width !== 0) {
			this.rect = rect;
		}

		return rect;
	}

	dispose(): void {
		window.removeEventListener('mousemove', this.onWindowMouseMove);
		window.removeEventListener('mouseup', this.onWindowMouseUp);
	}
}