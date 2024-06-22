import { Bounds, Vector, Vertices } from "matter-js";
import { Rect } from "../Window";

interface VisualizePointsOptions {
	scale: number;
	padding: number;
	clear: boolean;
	fill: boolean;
	showPosition: boolean;
	showIndex: boolean;
}

export class Util {
	static getGUID(): string {
		return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
			(+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
		);
	}

	static insertSpaces(str: string): string {
		return str.charAt(0).toUpperCase() + str.replace(/([A-Z])/g, ' $1').trim().substring(1);
	}

	static clone<T = any>(obj: T): T {
		return JSON.parse(JSON.stringify(obj)) as T;
	}

	static rectToBounds(rect: Rect): Bounds {
		return {
			min: {
				x: rect.x,
				y: rect.y
			},
			max: {
				x: rect.x + rect.width,
				y: rect.y + rect.height
			}
		};
	}

	static inflateBounds(bounds: Bounds, size: number): Bounds {
		return {
			min: {
				x: bounds.min.x - size,
				y: bounds.min.y - size
			},
			max: {
				x: bounds.max.x + size,
				y: bounds.max.y + size
			}
		};
	}

	static isVector(value: any): value is Vector {
		return typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number';
	}

	static clamp(val: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, val));
	}

	static clamp01(val: number): number {
		return Util.clamp(val, 0, 1);
	}

	static visualizePoints(points: Vector[], opts?: VisualizePointsOptions): HTMLCanvasElement|null {
		opts = Object.assign({
			scale: .4,
			padding: 30,
			clear: true,
			fill: false,
			showPosition: false,
			showIndex: true,
		}, opts ?? {});

		if (opts.clear) {
			for (const canvas of document.querySelectorAll('.util-canvas')) {
				canvas.remove();
			}
		}

		const scaledPoints = Vertices.scale(Util.clone(points), opts.scale, opts.scale, Vector.create(0, 0));
		const bounds = Bounds.create(scaledPoints);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return null;
		}

		const pos = (point: Vector): [number, number] => [point.x - bounds.min.x + opts.padding / 2, point.y - bounds.min.y + opts.padding / 2];

		canvas.width = bounds.max.x - bounds.min.x + opts.padding;
		canvas.height = bounds.max.y - bounds.min.y + opts.padding;
		ctx.fillStyle = 'red';
		ctx.font = '22px Arial';

		ctx.beginPath();
		for (const point of scaledPoints) {
			const [x, y] = pos(point);
			if (opts.fill) {
				ctx.lineTo(x, y);
			} else {
				ctx.moveTo(x, y);
				ctx.arc(x, y, 5, 0, Math.PI * 2);
			}
		}

		if (opts.fill) {
			ctx.closePath();
		}

		ctx.fill();

		ctx.fillStyle = 'black';
		for (let i = 0; i < scaledPoints.length; i++) {
			ctx.fillText(`${opts.showIndex ? i : ''}${opts.showPosition ? `(${points[i].x}x${points[i].y})`: ''}`, ...pos(scaledPoints[i]));
		}

		canvas.classList.add('util-canvas');
		document.body.append(canvas);
		return canvas;
	}
}

// @ts-ignore
window.Util = Util;