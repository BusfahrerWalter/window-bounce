import { Vector } from 'matter-js';
import { Form } from './Form';
import { Util } from '../../util/Util';

export class Slider2DForm extends Form<Vector> {

	private isMouseDown: boolean = false;
	private dom?: HTMLElement;
	private rect?: DOMRect;
	private dot?: HTMLElement;
	private display?: HTMLElement

	constructor(config?: any) {
		super(config);
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

		this.setDotPosByValue(value);
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

	private setDotPos(pos: Vector) {
		const rect = this.getRect();
		const relativePos = Vector.create(pos.x / rect.width, pos.y / rect.height);
		const clampedPos = Vector.create(Util.clamp01(relativePos.x), Util.clamp01(relativePos.y));
		this.setDotPos01(clampedPos);
	}

	private setDotPos01(pos: Vector) {
		if (!this.dot || !this.dom || !this.display) {
			return;
		}

		this.dot.style.setProperty('top', `${pos.y * 100}%`);
		this.dot.style.setProperty('left', `${pos.x * 100}%`);

		const diff = this.config.max - this.config.min;
		const value = Vector.mult(pos, diff);
		value.x += this.config.min;
		value.y += this.config.min;

		this.display.textContent = `${value.x.toFixed(2)} x ${value.y.toFixed(2)}`;
		this.onChange.emit(value);
	}

	private setDotPosByValue(val: Vector) {
		const diff = this.config.max - this.config.min;
		const value = Vector.create(
			val.x / diff + (diff / 2) / diff,
			val.y / diff + (diff / 2) / diff
		);

		this.setDotPos01(value);
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